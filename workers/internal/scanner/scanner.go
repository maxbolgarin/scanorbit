package scanner

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/awsclient"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Scanner orchestrates AWS resource scanning.
type Scanner struct {
	awsClient             *awsclient.Client
	store                 *store.Store
	ec2Scanner            *awsclient.EC2Scanner
	rdsScanner            *awsclient.RDSScanner
	s3Scanner             *awsclient.S3Scanner
	albScanner            *awsclient.ALBScanner
	acmScanner            *awsclient.ACMScanner
	lambdaScanner         *awsclient.LambdaScanner
	cloudwatchScanner     *awsclient.CloudWatchScanner
	iamScanner            *awsclient.IAMScanner
	securityGroupScanner  *awsclient.SecurityGroupScanner
	secretsManagerScanner *awsclient.SecretsManagerScanner
	kmsScanner            *awsclient.KMSScanner
	concurrency           int
	logger                zerolog.Logger
}

// NewScanner creates a new Scanner.
func NewScanner(
	awsClient *awsclient.Client,
	st *store.Store,
	concurrency int,
	logger zerolog.Logger,
) *Scanner {
	return &Scanner{
		awsClient:             awsClient,
		store:                 st,
		ec2Scanner:            awsclient.NewEC2Scanner(logger),
		rdsScanner:            awsclient.NewRDSScanner(logger),
		s3Scanner:             awsclient.NewS3Scanner(logger),
		albScanner:            awsclient.NewALBScanner(logger),
		acmScanner:            awsclient.NewACMScanner(logger),
		lambdaScanner:         awsclient.NewLambdaScanner(logger),
		cloudwatchScanner:     awsclient.NewCloudWatchScanner(logger),
		iamScanner:            awsclient.NewIAMScanner(logger),
		securityGroupScanner:  awsclient.NewSecurityGroupScanner(logger),
		secretsManagerScanner: awsclient.NewSecretsManagerScanner(logger),
		kmsScanner:            awsclient.NewKMSScanner(logger),
		concurrency:           concurrency,
		logger:                logger.With().Str("component", "scanner").Logger(),
	}
}

// ScanAccount scans all resources for an AWS account.
func (s *Scanner) ScanAccount(ctx context.Context, job *models.ScanAccountJob) error {
	startedAt := time.Now()

	// Validate job payload
	if job.AccountID == "" {
		return errors.New("account_id is required but was empty")
	}
	if job.OrgID == "" {
		return errors.New("org_id is required but was empty")
	}

	s.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting account scan")

	// 1. Fetch account details
	account, err := s.store.Accounts.GetByID(ctx, job.AccountID)
	if err != nil {
		return fmt.Errorf("get account: %w", err)
	}

	// 2. Create scan record
	scan := &store.Scan{
		ID:           uuid.New().String(),
		OrgID:        job.OrgID,
		AWSAccountID: job.AccountID,
		Status:       "running",
		StartedAt:    &startedAt,
	}
	if err := s.store.Scans.Create(ctx, scan); err != nil {
		return fmt.Errorf("create scan: %w", err)
	}

	// 3. Assume role
	cfg, err := s.awsClient.GetConfigForAccount(ctx, account.RoleARN, account.ExternalID)
	if err != nil {
		s.handleScanError(ctx, scan.ID, job.AccountID, err)
		return fmt.Errorf("assume role: %w", err)
	}

	// 4. List enabled regions
	regions, err := s.awsClient.ListEnabledRegions(ctx, cfg)
	if err != nil {
		s.handleScanError(ctx, scan.ID, job.AccountID, err)
		return fmt.Errorf("list regions: %w", err)
	}

	s.logger.Info().
		Str("account_id", job.AccountID).
		Int("regions", len(regions)).
		Msg("scanning regions")

	// 5. Fan-out: scan regions concurrently
	resultsChan := make(chan *RegionResult, len(regions))
	sem := make(chan struct{}, s.concurrency) // Limit concurrency
	var wg sync.WaitGroup

	for _, region := range regions {
		wg.Add(1)
		go func(r string) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			result := s.scanRegion(ctx, cfg, r)
			resultsChan <- result
		}(region)
	}

	// Close results channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// 6. Global scans (S3 and IAM - not region-specific)
	var globalResources []*models.Resource

	// S3 scan (global, once)
	s3Resources, err := s.s3Scanner.ScanBuckets(ctx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("s3 scan failed")
	} else {
		globalResources = append(globalResources, s3Resources...)
	}

	// IAM scans (global, not region-specific)
	iamUsers, err := s.iamScanner.ScanUsers(ctx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam users scan failed")
	} else {
		globalResources = append(globalResources, iamUsers...)
	}

	iamRoles, err := s.iamScanner.ScanRoles(ctx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam roles scan failed")
	} else {
		globalResources = append(globalResources, iamRoles...)
	}

	iamAccessKeys, err := s.iamScanner.ScanAccessKeys(ctx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam access keys scan failed")
	} else {
		globalResources = append(globalResources, iamAccessKeys...)
	}

	// 7. Fan-in: collect and persist results
	totalResources := 0
	var scanErrors []error

	for result := range resultsChan {
		if result.Error != nil {
			s.logger.Warn().Err(result.Error).Str("region", result.Region).Msg("region scan failed")
			scanErrors = append(scanErrors, result.Error)
			continue
		}

		// Persist resources
		for _, r := range result.Resources {
			r.OrgID = job.OrgID
			r.AWSAccountID = job.AccountID
			if err := s.store.Resources.Upsert(ctx, r); err != nil {
				s.logger.Error().Err(err).Str("resource_id", r.ResourceID).Msg("failed to upsert resource")
				continue
			}
			totalResources++
		}

		// Persist certificates
		for _, c := range result.Certificates {
			c.OrgID = job.OrgID
			c.AWSAccountID = job.AccountID
			if err := s.store.Certificates.Upsert(ctx, c); err != nil {
				s.logger.Error().Err(err).Str("cert_id", c.Identifier).Msg("failed to upsert certificate")
			}
		}
	}

	// Persist global resources (S3, IAM)
	for _, r := range globalResources {
		r.OrgID = job.OrgID
		r.AWSAccountID = job.AccountID
		if err := s.store.Resources.Upsert(ctx, r); err != nil {
			s.logger.Error().Err(err).Str("resource_id", r.ResourceID).Msg("failed to upsert global resource")
			continue
		}
		totalResources++
	}

	// 8. Update scan status
	completedAt := time.Now()
	status := "complete"
	errMsg := ""
	if len(scanErrors) > 0 {
		status = "partial"
		errMsg = fmt.Sprintf("%d region(s) failed", len(scanErrors))
	}

	if err := s.store.Scans.UpdateStatus(ctx, scan.ID, status, totalResources, errMsg); err != nil {
		s.logger.Error().Err(err).Msg("failed to update scan status")
	}
	if err := s.store.Accounts.UpdateLastScanAt(ctx, job.AccountID, completedAt); err != nil {
		s.logger.Error().Err(err).Msg("failed to update last_scan_at")
	}
	if err := s.store.Accounts.UpdateStatus(ctx, job.AccountID, "ok", ""); err != nil {
		s.logger.Error().Err(err).Msg("failed to update account status")
	}

	s.logger.Info().
		Str("account_id", job.AccountID).
		Int("resources", totalResources).
		Dur("duration", completedAt.Sub(startedAt)).
		Str("status", status).
		Msg("scan completed")

	return nil
}

// scanRegion handles scanning a single region.
func (s *Scanner) scanRegion(ctx context.Context, cfg aws.Config, region string) *RegionResult {
	result := &RegionResult{Region: region}
	var mu sync.Mutex
	var wg sync.WaitGroup

	// EC2 Instances
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanInstances(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("ec2 instances scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// EBS Volumes
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanVolumes(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("ebs volumes scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// EIPs
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanEIPs(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("eip scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// RDS Instances
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.rdsScanner.ScanInstances(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("rds instances scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// RDS Snapshots
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.rdsScanner.ScanSnapshots(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("rds snapshots scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// ALBs
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.albScanner.ScanLoadBalancers(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("alb scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// ACM Certificates
	wg.Add(1)
	go func() {
		defer wg.Done()
		certs, err := s.acmScanner.ScanCertificates(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("acm scan failed")
			return
		}
		mu.Lock()
		result.Certificates = append(result.Certificates, certs...)
		mu.Unlock()
	}()

	// Lambda Functions
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.lambdaScanner.ScanFunctions(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("lambda scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// CloudWatch Log Groups
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.cloudwatchScanner.ScanLogGroups(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("cloudwatch logs scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// CloudWatch Alarms
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.cloudwatchScanner.ScanAlarms(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("cloudwatch alarms scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// Security Groups
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.securityGroupScanner.ScanSecurityGroups(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("security groups scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// Secrets Manager
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.secretsManagerScanner.ScanSecrets(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("secrets manager scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// KMS Keys
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.kmsScanner.ScanKeys(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("kms scan failed")
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	wg.Wait()
	return result
}

// handleScanError updates scan and account status on error.
func (s *Scanner) handleScanError(ctx context.Context, scanID, accountID string, err error) {
	if updateErr := s.store.Scans.UpdateStatus(ctx, scanID, "error", 0, err.Error()); updateErr != nil {
		s.logger.Error().Err(updateErr).Msg("failed to update scan status")
	}
	if updateErr := s.store.Accounts.UpdateStatus(ctx, accountID, "error", err.Error()); updateErr != nil {
		s.logger.Error().Err(updateErr).Msg("failed to update account status")
	}
}
