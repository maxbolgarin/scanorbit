package metrics

import (
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	once     sync.Once
	registry *prometheus.Registry

	// Service info
	ServiceInfo *prometheus.GaugeVec

	// Job metrics
	JobsProcessedTotal *prometheus.CounterVec
	JobProcessingTime  *prometheus.HistogramVec
	JobsInFlight       *prometheus.GaugeVec
	JobErrors          *prometheus.CounterVec

	// Queue metrics
	QueueLength *prometheus.GaugeVec

	// Database metrics
	DBQueriesTotal    *prometheus.CounterVec
	DBQueryDuration   *prometheus.HistogramVec
	DBConnectionsOpen *prometheus.GaugeVec

	// Redis metrics
	RedisOperationsTotal *prometheus.CounterVec
	RedisOperationTime   *prometheus.HistogramVec

	// AWS metrics
	AWSAPICallsTotal *prometheus.CounterVec
	AWSAPICallTime   *prometheus.HistogramVec

	// Business metrics (Scanner)
	ResourcesDiscovered *prometheus.CounterVec
	ScansCompleted      *prometheus.CounterVec
	ScanDuration        *prometheus.HistogramVec
	RegionsScanned      *prometheus.CounterVec

	// Business metrics (Analyzer)
	FindingsCreated   *prometheus.CounterVec
	AnalysesCompleted *prometheus.CounterVec
	AnalysisDuration  *prometheus.HistogramVec

	// Runtime metrics
	GoroutinesCount prometheus.Gauge
	MemoryUsage     *prometheus.GaugeVec
	UptimeSeconds   prometheus.Gauge

	startTime time.Time
)

// Config holds metrics configuration
type Config struct {
	ServiceName string
	Environment string
	Version     string
}

// Init initializes the metrics registry and registers all metrics
func Init(cfg Config) {
	once.Do(func() {
		startTime = time.Now()
		registry = prometheus.NewRegistry()

		// Register Go runtime collectors
		registry.MustRegister(collectors.NewGoCollector())
		registry.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

		// Service info
		ServiceInfo = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "service_info",
				Help: "Service information",
			},
			[]string{"service", "version", "go_version", "env"},
		)
		registry.MustRegister(ServiceInfo)
		ServiceInfo.WithLabelValues(cfg.ServiceName, cfg.Version, runtime.Version(), cfg.Environment).Set(1)

		// Job metrics
		JobsProcessedTotal = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "jobs_processed_total",
				Help: "Total number of jobs processed",
			},
			[]string{"service", "job_type", "status"},
		)
		registry.MustRegister(JobsProcessedTotal)

		JobProcessingTime = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "job_processing_duration_seconds",
				Help:    "Job processing duration in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600},
			},
			[]string{"service", "job_type"},
		)
		registry.MustRegister(JobProcessingTime)

		JobsInFlight = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "jobs_in_flight",
				Help: "Number of jobs currently being processed",
			},
			[]string{"service", "job_type"},
		)
		registry.MustRegister(JobsInFlight)

		JobErrors = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "job_errors_total",
				Help: "Total number of job processing errors",
			},
			[]string{"service", "job_type", "error_type"},
		)
		registry.MustRegister(JobErrors)

		// Queue metrics
		QueueLength = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "queue_length",
				Help: "Current queue length",
			},
			[]string{"queue_name"},
		)
		registry.MustRegister(QueueLength)

		// Database metrics
		DBQueriesTotal = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "db_queries_total",
				Help: "Total number of database queries",
			},
			[]string{"operation", "table", "status"},
		)
		registry.MustRegister(DBQueriesTotal)

		DBQueryDuration = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "db_query_duration_seconds",
				Help:    "Database query duration in seconds",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
			},
			[]string{"operation", "table"},
		)
		registry.MustRegister(DBQueryDuration)

		DBConnectionsOpen = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "db_connections_open",
				Help: "Number of open database connections",
			},
			[]string{"state"},
		)
		registry.MustRegister(DBConnectionsOpen)

		// Redis metrics
		RedisOperationsTotal = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_operations_total",
				Help: "Total number of Redis operations",
			},
			[]string{"operation", "status"},
		)
		registry.MustRegister(RedisOperationsTotal)

		RedisOperationTime = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "redis_operation_duration_seconds",
				Help:    "Redis operation duration in seconds",
				Buckets: []float64{0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25},
			},
			[]string{"operation"},
		)
		registry.MustRegister(RedisOperationTime)

		// AWS metrics
		AWSAPICallsTotal = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "aws_api_calls_total",
				Help: "Total number of AWS API calls",
			},
			[]string{"service", "operation", "status"},
		)
		registry.MustRegister(AWSAPICallsTotal)

		AWSAPICallTime = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "aws_api_call_duration_seconds",
				Help:    "AWS API call duration in seconds",
				Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
			},
			[]string{"service", "operation"},
		)
		registry.MustRegister(AWSAPICallTime)

		// Business metrics (Scanner)
		ResourcesDiscovered = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "resources_discovered_total",
				Help: "Total number of resources discovered",
			},
			[]string{"service_type", "region"},
		)
		registry.MustRegister(ResourcesDiscovered)

		ScansCompleted = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "scans_completed_total",
				Help: "Total number of scans completed",
			},
			[]string{"status"},
		)
		registry.MustRegister(ScansCompleted)

		ScanDuration = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "scan_duration_seconds",
				Help:    "Scan duration in seconds",
				Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600, 1200},
			},
			[]string{"account_id"},
		)
		registry.MustRegister(ScanDuration)

		RegionsScanned = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "regions_scanned_total",
				Help: "Total number of regions scanned",
			},
			[]string{"region"},
		)
		registry.MustRegister(RegionsScanned)

		// Business metrics (Analyzer)
		FindingsCreated = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "findings_created_total",
				Help: "Total number of findings created",
			},
			[]string{"analyzer_type", "severity"},
		)
		registry.MustRegister(FindingsCreated)

		AnalysesCompleted = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "analyses_completed_total",
				Help: "Total number of analyses completed",
			},
			[]string{"analyzer_type", "status"},
		)
		registry.MustRegister(AnalysesCompleted)

		AnalysisDuration = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "analysis_duration_seconds",
				Help:    "Analysis duration in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120},
			},
			[]string{"analyzer_type"},
		)
		registry.MustRegister(AnalysisDuration)

		// Runtime metrics
		GoroutinesCount = prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "goroutines_count",
				Help: "Number of goroutines",
			},
		)
		registry.MustRegister(GoroutinesCount)

		MemoryUsage = prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "memory_usage_bytes",
				Help: "Memory usage in bytes",
			},
			[]string{"type"},
		)
		registry.MustRegister(MemoryUsage)

		UptimeSeconds = prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "uptime_seconds",
				Help: "Service uptime in seconds",
			},
		)
		registry.MustRegister(UptimeSeconds)

		// Start background goroutine to update runtime metrics
		go updateRuntimeMetrics()
	})
}

// Handler returns an HTTP handler for the metrics endpoint
func Handler() http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}

// updateRuntimeMetrics periodically updates runtime metrics
func updateRuntimeMetrics() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Update goroutine count
		GoroutinesCount.Set(float64(runtime.NumGoroutine()))

		// Update memory stats
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		MemoryUsage.WithLabelValues("alloc").Set(float64(m.Alloc))
		MemoryUsage.WithLabelValues("sys").Set(float64(m.Sys))
		MemoryUsage.WithLabelValues("heap_alloc").Set(float64(m.HeapAlloc))
		MemoryUsage.WithLabelValues("heap_sys").Set(float64(m.HeapSys))

		// Update uptime
		UptimeSeconds.Set(time.Since(startTime).Seconds())
	}
}

// TrackJobProcessing returns a function to track job processing time
func TrackJobProcessing(service, jobType string) func(status string) {
	start := time.Now()
	JobsInFlight.WithLabelValues(service, jobType).Inc()

	return func(status string) {
		duration := time.Since(start).Seconds()
		JobsInFlight.WithLabelValues(service, jobType).Dec()
		JobsProcessedTotal.WithLabelValues(service, jobType, status).Inc()
		JobProcessingTime.WithLabelValues(service, jobType).Observe(duration)
	}
}

// TrackDBQuery returns a function to track database query time
func TrackDBQuery(operation, table string) func(status string) {
	start := time.Now()

	return func(status string) {
		duration := time.Since(start).Seconds()
		DBQueriesTotal.WithLabelValues(operation, table, status).Inc()
		DBQueryDuration.WithLabelValues(operation, table).Observe(duration)
	}
}

// TrackRedisOperation returns a function to track Redis operation time
func TrackRedisOperation(operation string) func(status string) {
	start := time.Now()

	return func(status string) {
		duration := time.Since(start).Seconds()
		RedisOperationsTotal.WithLabelValues(operation, status).Inc()
		RedisOperationTime.WithLabelValues(operation).Observe(duration)
	}
}

// TrackAWSAPICall returns a function to track AWS API call time
func TrackAWSAPICall(service, operation string) func(status string) {
	start := time.Now()

	return func(status string) {
		duration := time.Since(start).Seconds()
		AWSAPICallsTotal.WithLabelValues(service, operation, status).Inc()
		AWSAPICallTime.WithLabelValues(service, operation).Observe(duration)
	}
}
