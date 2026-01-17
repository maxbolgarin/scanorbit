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
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	// regionScanTimeout is the maximum time allowed for scanning a single region
	regionScanTimeout = 10 * time.Minute
	// globalScanTimeout is the maximum time allowed for global scans (S3, IAM)
	globalScanTimeout = 15 * time.Minute
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
	dependencyExtractor   *DependencyExtractor
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
		dependencyExtractor:   NewDependencyExtractor(),
		concurrency:           concurrency,
		logger:                logger.With().Str("component", "scanner").Logger(),
	}
}

// ScanAccount scans all resources for an AWS account.
func (s *Scanner) ScanAccount(ctx context.Context, job *models.ScanAccountJob) error {
	startedAt := time.Now()

	// Track job processing
	finishJob := metrics.TrackJobProcessing("scanner", "scan_account")
	defer func() {
		// Will be called with proper status at the end
	}()

	// Validate job payload
	if job.AccountID == "" {
		finishJob("error")
		return errors.New("account_id is required but was empty")
	}
	if job.OrgID == "" {
		finishJob("error")
		return errors.New("org_id is required but was empty")
	}

	s.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting account scan")

	// 0. Check if account still exists (may have been deleted while job was queued)
	exists, err := s.store.Accounts.Exists(ctx, job.AccountID)
	if err != nil {
		s.logger.Warn().Err(err).Str("account_id", job.AccountID).Msg("failed to check account existence")
	}
	if !exists {
		s.logger.Warn().Str("account_id", job.AccountID).Msg("account not found, skipping scan (likely deleted)")
		finishJob("skipped")
		return nil // Return nil to not retry - account was deleted
	}

	// 1. Fetch account details
	account, err := s.store.Accounts.GetByID(ctx, job.AccountID)
	if err != nil {
		return fmt.Errorf("get account: %w", err)
	}

	// 2. Get or create scan record with 'processing' status
	accountID := job.AccountID
	var scanID string
	if job.ScanID != "" {
		// Use existing scan record from job payload
		scanID = job.ScanID
		if err := s.store.Scans.UpdateStatusWithStart(ctx, scanID, string(models.ScanStatusProcessing)); err != nil {
			s.logger.Warn().Err(err).Str("scan_id", scanID).Msg("failed to update scan to processing")
		}
	} else {
		// Backwards compatibility: create new scan record if no scan_id provided
		scan := &store.Scan{
			ID:           uuid.New().String(),
			OrgID:        job.OrgID,
			AWSAccountID: &accountID,
			Status:       string(models.ScanStatusProcessing),
			StartedAt:    &startedAt,
		}
		if err := s.store.Scans.Create(ctx, scan); err != nil {
			return fmt.Errorf("create scan: %w", err)
		}
		scanID = scan.ID
	}

	// 3. Assume role
	cfg, err := s.awsClient.GetConfigForAccount(ctx, account.RoleARN, account.ExternalID)
	if err != nil {
		s.handleScanError(ctx, scanID, job.AccountID, err)
		finishJob("error")
		metrics.JobErrors.WithLabelValues("scanner", "scan_account", "assume_role").Inc()
		return fmt.Errorf("assume role: %w", err)
	}

	// 4. Update status to 'running' after successful credential validation
	if err := s.store.Scans.UpdateStatusOnly(ctx, scanID, string(models.ScanStatusRunning)); err != nil {
		s.logger.Warn().Err(err).Msg("failed to update scan to running status")
	}

	// 5. List enabled regions
	regions, err := s.awsClient.ListEnabledRegions(ctx, cfg)
	if err != nil {
		s.handleScanError(ctx, scanID, job.AccountID, err)
		finishJob("error")
		metrics.JobErrors.WithLabelValues("scanner", "scan_account", "list_regions").Inc()
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

			// Create a context with timeout for this region scan
			regionCtx, cancel := context.WithTimeout(ctx, regionScanTimeout)
			defer cancel()

			result := s.scanRegion(regionCtx, cfg, r)
			if regionCtx.Err() == context.DeadlineExceeded {
				s.logger.Warn().Str("region", r).Msg("region scan timed out")
				result.Error = fmt.Errorf("scan timed out after %v", regionScanTimeout)
			}
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

	// Create a context with timeout for global scans
	globalCtx, globalCancel := context.WithTimeout(ctx, globalScanTimeout)
	defer globalCancel()

	// S3 scan (global, once)
	s3Resources, err := s.s3Scanner.ScanBuckets(globalCtx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("s3 scan failed")
	} else {
		globalResources = append(globalResources, s3Resources...)
	}

	// IAM scans (global, not region-specific)
	iamUsers, err := s.iamScanner.ScanUsers(globalCtx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam users scan failed")
	} else {
		globalResources = append(globalResources, iamUsers...)
	}

	iamRoles, err := s.iamScanner.ScanRoles(globalCtx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam roles scan failed")
	} else {
		globalResources = append(globalResources, iamRoles...)
	}

	iamAccessKeys, err := s.iamScanner.ScanAccessKeys(globalCtx, cfg)
	if err != nil {
		s.logger.Warn().Err(err).Msg("iam access keys scan failed")
	} else {
		globalResources = append(globalResources, iamAccessKeys...)
	}

	// 7. Fan-in: collect and persist results
	totalResources := 0
	var scanErrors []error
	var partialFailures int

	// Track resource-scan history
	var resourceScanRecords []*models.ResourceScan
	var foundResourceIDs []string

	for result := range resultsChan {
		if result.Error != nil {
			s.logger.Warn().Err(result.Error).Str("region", result.Region).Msg("region scan failed")
			scanErrors = append(scanErrors, result.Error)
			continue
		}

		// Log partial failures (individual scanner errors within a region)
		if len(result.ScannerErrors) > 0 {
			s.logger.Warn().
				Str("region", result.Region).
				Strs("scanner_errors", result.ScannerErrors).
				Msg("region scan completed with partial failures")
			partialFailures += len(result.ScannerErrors)
		}
		// Track region scanned
		metrics.RegionsScanned.WithLabelValues(result.Region).Inc()

		// Persist resources and extract dependencies
		var allDeps []*models.ResourceDependency
		for _, r := range result.Resources {
			r.OrgID = job.OrgID
			r.AWSAccountID = job.AccountID

			// Upsert with status to track new vs updated resources
			resourceID, isNew, err := s.store.Resources.UpsertWithStatus(ctx, r)
			if err != nil {
				s.logger.Error().Err(err).Str("resource_id", r.ResourceID).Msg("failed to upsert resource")
				continue
			}
			// CRITICAL: Update resource ID to match the DB ID (for existing resources, UpsertWithStatus returns the existing ID)
			r.ID = resourceID
			s.logger.Debug().Str("resource_id", r.ResourceID).Str("db_id", r.ID).Bool("is_new", isNew).Msg("resource upserted with DB ID")
			totalResources++

			// Track for resource-scan history
			foundResourceIDs = append(foundResourceIDs, resourceID)
			status := models.ResourceScanStatusUpdated
			if isNew {
				status = models.ResourceScanStatusNew
			}
			resourceScanRecords = append(resourceScanRecords, models.NewResourceScan(resourceID, scanID, status))

			// Track resource discovery by type and region
			metrics.ResourcesDiscovered.WithLabelValues(string(r.Service), result.Region).Inc()

			// Extract dependencies for this resource
			deps := s.dependencyExtractor.ExtractDependencies(r)
			for _, dep := range deps {
				dep.OrgID = job.OrgID
			}
			allDeps = append(allDeps, deps...)
		}

		// Bulk upsert dependencies for this region
		if len(allDeps) > 0 {
			s.logger.Debug().Int("count", len(allDeps)).Str("region", result.Region).Msg("upserting dependencies")
			if err := s.store.Dependencies.BulkUpsert(ctx, allDeps); err != nil {
				s.logger.Error().Err(err).Int("count", len(allDeps)).Str("region", result.Region).Msg("failed to upsert dependencies")
				// Log first dependency for debugging
				if len(allDeps) > 0 {
					s.logger.Error().
						Str("source_resource_id", allDeps[0].SourceResourceID).
						Str("target_resource_id", allDeps[0].TargetResourceID).
						Str("org_id", allDeps[0].OrgID).
						Msg("first dependency that failed")
				}
			} else {
				s.logger.Info().Int("count", len(allDeps)).Str("region", result.Region).Msg("dependencies upserted successfully")
			}
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

	// Persist global resources (S3, IAM) and extract dependencies
	var globalDeps []*models.ResourceDependency
	for _, r := range globalResources {
		r.OrgID = job.OrgID
		r.AWSAccountID = job.AccountID

		// Upsert with status to track new vs updated resources
		resourceID, isNew, err := s.store.Resources.UpsertWithStatus(ctx, r)
		if err != nil {
			s.logger.Error().Err(err).Str("resource_id", r.ResourceID).Msg("failed to upsert global resource")
			continue
		}
		// CRITICAL: Update resource ID to match the DB ID (for existing resources, UpsertWithStatus returns the existing ID)
		r.ID = resourceID
		s.logger.Debug().Str("resource_id", r.ResourceID).Str("db_id", r.ID).Bool("is_new", isNew).Msg("global resource upserted with DB ID")
		totalResources++

		// Track for resource-scan history
		foundResourceIDs = append(foundResourceIDs, resourceID)
		status := models.ResourceScanStatusUpdated
		if isNew {
			status = models.ResourceScanStatusNew
		}
		resourceScanRecords = append(resourceScanRecords, models.NewResourceScan(resourceID, scanID, status))

		// Track global resource discovery (region is "global" for S3/IAM)
		metrics.ResourcesDiscovered.WithLabelValues(string(r.Service), "global").Inc()

		// Extract dependencies for this resource
		deps := s.dependencyExtractor.ExtractDependencies(r)
		for _, dep := range deps {
			dep.OrgID = job.OrgID
		}
		globalDeps = append(globalDeps, deps...)
	}

	// Bulk upsert global resource dependencies
	if len(globalDeps) > 0 {
		s.logger.Debug().Int("count", len(globalDeps)).Msg("upserting global dependencies")
		if err := s.store.Dependencies.BulkUpsert(ctx, globalDeps); err != nil {
			s.logger.Error().Err(err).Int("count", len(globalDeps)).Msg("failed to upsert global dependencies")
			if len(globalDeps) > 0 {
				s.logger.Error().
					Str("source_resource_id", globalDeps[0].SourceResourceID).
					Str("target_resource_id", globalDeps[0].TargetResourceID).
					Str("org_id", globalDeps[0].OrgID).
					Msg("first global dependency that failed")
			}
		} else {
			s.logger.Info().Int("count", len(globalDeps)).Msg("global dependencies upserted successfully")
		}
	}

	// 7.1. Resource-scan history tracking
	// Mark resources that were in the previous scan but not in this scan as 'removed'
	if err := s.store.ResourceScans.MarkRemovedResources(ctx, scanID, job.AccountID, foundResourceIDs); err != nil {
		s.logger.Error().Err(err).Msg("failed to mark removed resources")
	}

	// Bulk insert resource-scan records
	if len(resourceScanRecords) > 0 {
		if err := s.store.ResourceScans.BulkUpsert(ctx, resourceScanRecords); err != nil {
			s.logger.Error().Err(err).Msg("failed to insert resource-scan records")
		}
	}

	// Auto-delete stale resources (removed in 3+ consecutive scans)
	const minScansForDeletion = 3
	deleted, err := s.store.ResourceScans.DeleteStaleResources(ctx, job.AccountID, minScansForDeletion)
	if err != nil {
		s.logger.Warn().Err(err).Msg("failed to delete stale resources")
	} else if deleted > 0 {
		s.logger.Info().Int64("count", deleted).Msg("deleted stale resources")
	}

	// 8. Update scan status
	completedAt := time.Now()
	status := "complete"
	errMsg := ""
	if len(scanErrors) > 0 {
		status = "partial"
		errMsg = fmt.Sprintf("%d region(s) failed", len(scanErrors))
	} else if partialFailures > 0 {
		status = "partial"
		errMsg = fmt.Sprintf("%d scanner(s) failed across regions", partialFailures)
	}

	// Atomically update scan and account status
	if err := s.store.CompleteScanWithAccount(ctx, scanID, job.AccountID, status, totalResources, errMsg, completedAt); err != nil {
		s.logger.Error().Err(err).Msg("failed to complete scan with account update")
	}

	// Track scan completion metrics
	scanDuration := completedAt.Sub(startedAt).Seconds()
	metrics.ScanDuration.WithLabelValues(job.AccountID).Observe(scanDuration)
	metrics.ScansCompleted.WithLabelValues(status).Inc()
	finishJob("success")

	s.logger.Info().
		Str("account_id", job.AccountID).
		Int("resources", totalResources).
		Int("partial_failures", partialFailures).
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

	// Helper to record scanner errors
	recordError := func(scanner string, err error) {
		mu.Lock()
		result.ScannerErrors = append(result.ScannerErrors, fmt.Sprintf("%s: %v", scanner, err))
		mu.Unlock()
	}

	// EC2 Instances
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanInstances(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("ec2 instances scan failed")
			recordError("ec2_instances", err)
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
			recordError("ebs_volumes", err)
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
			recordError("eips", err)
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// ENIs (Elastic Network Interfaces)
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanENIs(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("eni scan failed")
			recordError("enis", err)
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	// NAT Gateways
	wg.Add(1)
	go func() {
		defer wg.Done()
		resources, err := s.ec2Scanner.ScanNATGateways(ctx, cfg, region)
		if err != nil {
			s.logger.Warn().Err(err).Str("region", region).Msg("nat gateway scan failed")
			recordError("nat_gateways", err)
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
			recordError("rds_instances", err)
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
			recordError("rds_snapshots", err)
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
			recordError("alb", err)
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
			recordError("acm", err)
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
			recordError("lambda", err)
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
			recordError("cloudwatch_logs", err)
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
			recordError("cloudwatch_alarms", err)
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
			recordError("security_groups", err)
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
			recordError("secrets_manager", err)
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
			recordError("kms", err)
			return
		}
		mu.Lock()
		result.Resources = append(result.Resources, resources...)
		mu.Unlock()
	}()

	wg.Wait()
	return result
}

// handleScanError atomically updates scan and account status on error.
func (s *Scanner) handleScanError(ctx context.Context, scanID, accountID string, err error) {
	if updateErr := s.store.FailScanWithAccount(ctx, scanID, accountID, err.Error()); updateErr != nil {
		s.logger.Error().Err(updateErr).Msg("failed to update scan and account status")
	}
}
