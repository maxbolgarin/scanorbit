package pricing

// EC2 Instance Monthly Costs (on-demand, Linux, us-east-1 pricing)
// These are rough estimates for cost visibility, not billing
var EC2InstancePricing = map[string]float64{
	// T3 Series (General Purpose - Burstable)
	"t3.nano":    3.80,
	"t3.micro":   7.59,
	"t3.small":   15.18,
	"t3.medium":  30.37,
	"t3.large":   60.74,
	"t3.xlarge":  121.47,
	"t3.2xlarge": 242.94,

	// T3a Series (AMD)
	"t3a.nano":    3.42,
	"t3a.micro":   6.84,
	"t3a.small":   13.68,
	"t3a.medium":  27.36,
	"t3a.large":   54.72,
	"t3a.xlarge":  109.44,
	"t3a.2xlarge": 218.88,

	// T2 Series (Previous Gen Burstable)
	"t2.nano":    4.18,
	"t2.micro":   8.35,
	"t2.small":   16.71,
	"t2.medium":  33.41,
	"t2.large":   66.82,
	"t2.xlarge":  133.63,
	"t2.2xlarge": 267.26,

	// M5 Series (General Purpose)
	"m5.large":    70.08,
	"m5.xlarge":   140.16,
	"m5.2xlarge":  280.32,
	"m5.4xlarge":  560.64,
	"m5.8xlarge":  1121.28,
	"m5.12xlarge": 1681.92,
	"m5.16xlarge": 2242.56,
	"m5.24xlarge": 3363.84,

	// M6i Series (Latest Gen General Purpose)
	"m6i.large":    70.08,
	"m6i.xlarge":   140.16,
	"m6i.2xlarge":  280.32,
	"m6i.4xlarge":  560.64,
	"m6i.8xlarge":  1121.28,
	"m6i.12xlarge": 1681.92,
	"m6i.16xlarge": 2242.56,
	"m6i.24xlarge": 3363.84,

	// C5 Series (Compute Optimized)
	"c5.large":    62.05,
	"c5.xlarge":   124.10,
	"c5.2xlarge":  248.20,
	"c5.4xlarge":  496.40,
	"c5.9xlarge":  1116.90,
	"c5.12xlarge": 1489.20,
	"c5.18xlarge": 2233.80,
	"c5.24xlarge": 2978.40,

	// C6i Series (Latest Gen Compute Optimized)
	"c6i.large":    62.05,
	"c6i.xlarge":   124.10,
	"c6i.2xlarge":  248.20,
	"c6i.4xlarge":  496.40,
	"c6i.8xlarge":  992.80,
	"c6i.12xlarge": 1489.20,
	"c6i.16xlarge": 1985.60,
	"c6i.24xlarge": 2978.40,

	// R5 Series (Memory Optimized)
	"r5.large":    91.98,
	"r5.xlarge":   183.96,
	"r5.2xlarge":  367.92,
	"r5.4xlarge":  735.84,
	"r5.8xlarge":  1471.68,
	"r5.12xlarge": 2207.52,
	"r5.16xlarge": 2943.36,
	"r5.24xlarge": 4415.04,

	// R6i Series (Latest Gen Memory Optimized)
	"r6i.large":    91.98,
	"r6i.xlarge":   183.96,
	"r6i.2xlarge":  367.92,
	"r6i.4xlarge":  735.84,
	"r6i.8xlarge":  1471.68,
	"r6i.12xlarge": 2207.52,
	"r6i.16xlarge": 2943.36,
	"r6i.24xlarge": 4415.04,
}

// EBS Volume Monthly Costs (per GB-month)
var EBSVolumePricing = map[string]float64{
	"gp2":      0.10,  // General Purpose SSD
	"gp3":      0.08,  // General Purpose SSD (newer)
	"io1":      0.125, // Provisioned IOPS SSD
	"io2":      0.125, // Provisioned IOPS SSD (newer)
	"st1":      0.045, // Throughput Optimized HDD
	"sc1":      0.015, // Cold HDD
	"standard": 0.05,  // Magnetic (previous gen)
}

// EIP cost when unattached (per month)
const EIPUnattachedCost = 3.65 // ~$0.005/hour

// RDS Instance Monthly Costs (Single-AZ, on-demand)
var RDSInstancePricing = map[string]float64{
	// T3 Series
	"db.t3.micro":   12.41,
	"db.t3.small":   24.82,
	"db.t3.medium":  49.64,
	"db.t3.large":   99.28,
	"db.t3.xlarge":  198.56,
	"db.t3.2xlarge": 397.12,

	// T4g Series (Graviton)
	"db.t4g.micro":   11.83,
	"db.t4g.small":   23.65,
	"db.t4g.medium":  47.30,
	"db.t4g.large":   94.61,
	"db.t4g.xlarge":  189.22,
	"db.t4g.2xlarge": 378.43,

	// M5 Series
	"db.m5.large":    124.10,
	"db.m5.xlarge":   248.20,
	"db.m5.2xlarge":  496.40,
	"db.m5.4xlarge":  992.80,
	"db.m5.8xlarge":  1985.60,
	"db.m5.12xlarge": 2978.40,
	"db.m5.16xlarge": 3971.20,
	"db.m5.24xlarge": 5956.80,

	// M6i Series
	"db.m6i.large":    124.10,
	"db.m6i.xlarge":   248.20,
	"db.m6i.2xlarge":  496.40,
	"db.m6i.4xlarge":  992.80,
	"db.m6i.8xlarge":  1985.60,
	"db.m6i.12xlarge": 2978.40,
	"db.m6i.16xlarge": 3971.20,
	"db.m6i.24xlarge": 5956.80,

	// R5 Series (Memory Optimized)
	"db.r5.large":    182.50,
	"db.r5.xlarge":   365.00,
	"db.r5.2xlarge":  730.00,
	"db.r5.4xlarge":  1460.00,
	"db.r5.8xlarge":  2920.00,
	"db.r5.12xlarge": 4380.00,
	"db.r5.16xlarge": 5840.00,
	"db.r5.24xlarge": 8760.00,

	// R6i Series
	"db.r6i.large":    182.50,
	"db.r6i.xlarge":   365.00,
	"db.r6i.2xlarge":  730.00,
	"db.r6i.4xlarge":  1460.00,
	"db.r6i.8xlarge":  2920.00,
	"db.r6i.12xlarge": 4380.00,
	"db.r6i.16xlarge": 5840.00,
	"db.r6i.24xlarge": 8760.00,
}

// RDS Snapshot cost per GB-month
const RDSSnapshotCostPerGB = 0.095

// ALB Monthly Base Cost (hourly + LCU)
const ALBBaseCost = 16.43 // ~$0.0225/hour base

// NLB Monthly Base Cost (hourly only)
const NLBBaseCost = 6.57 // ~$0.009/hour base

// NAT Gateway Monthly Base Cost (hourly only, data processing extra)
const NATGatewayBaseCost = 32.40 // ~$0.045/hour base

// CloudWatch costs
const CloudWatchAlarmCost = 0.10          // per alarm-month (standard)
const CloudWatchLogsIngestionPerGB = 0.50 // per GB ingested
const CloudWatchLogsStoragePerGB = 0.03   // per GB-month stored

// Secrets Manager
const SecretsManagerPerSecret = 0.40 // per secret-month

// KMS
const KMSKeyPerMonth = 1.00 // per customer managed key-month

// S3 (Standard storage)
const S3CostPerGB = 0.023 // per GB-month

// S3 default estimate when size unknown
const S3DefaultBucketEstimate = 5.0 // assume ~200GB average

// LambdaEstimateCost calculates estimated monthly cost based on memory
// Assumes 1M invocations and 100ms average duration
func LambdaEstimateCost(memoryMB int) float64 {
	memoryGB := float64(memoryMB) / 1024.0
	requestCost := 0.20                                     // $0.20 per 1M requests
	durationCost := memoryGB * 0.1 * 1000000 * 0.0000166667 // 100ms * 1M invocations
	return requestCost + durationCost
}

// GetEC2Cost returns monthly cost for an EC2 instance type
// Returns 0 if instance type is unknown
func GetEC2Cost(instanceType string) float64 {
	if cost, ok := EC2InstancePricing[instanceType]; ok {
		return cost
	}
	return 0
}

// GetEBSCost returns monthly cost for an EBS volume
func GetEBSCost(volumeType string, sizeGB int) float64 {
	pricePerGB := 0.10 // default to gp2
	if price, ok := EBSVolumePricing[volumeType]; ok {
		pricePerGB = price
	}
	return pricePerGB * float64(sizeGB)
}

// GetRDSCost returns monthly cost for an RDS instance
// Doubles cost if multiAZ is true
func GetRDSCost(instanceClass string, multiAZ bool) float64 {
	cost := 50.0 // default estimate
	if c, ok := RDSInstancePricing[instanceClass]; ok {
		cost = c
	}
	if multiAZ {
		cost *= 2
	}
	return cost
}

// GetRDSSnapshotCost returns monthly cost for an RDS snapshot
func GetRDSSnapshotCost(sizeGB int) float64 {
	return RDSSnapshotCostPerGB * float64(sizeGB)
}

// GetCloudWatchLogsCost returns monthly cost for log group storage
func GetCloudWatchLogsCost(storedBytes int64) float64 {
	storedGB := float64(storedBytes) / (1024 * 1024 * 1024)
	return CloudWatchLogsStoragePerGB * storedGB
}
