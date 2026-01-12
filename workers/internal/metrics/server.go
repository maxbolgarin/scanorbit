package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/rs/zerolog"
)

// Server provides HTTP endpoints for metrics and status
type Server struct {
	server      *http.Server
	serviceName string
	version     string
	env         string
	logger      zerolog.Logger
}

// StatusResponse represents the JSON status response
type StatusResponse struct {
	Service       string            `json:"service"`
	Status        string            `json:"status"`
	Timestamp     string            `json:"timestamp"`
	Env           string            `json:"env"`
	Version       string            `json:"version"`
	GoVersion     string            `json:"go_version"`
	UptimeSeconds float64           `json:"uptime_seconds"`
	Goroutines    int               `json:"goroutines"`
	Memory        MemoryInfo        `json:"memory"`
	Config        map[string]string `json:"config,omitempty"`
}

// MemoryInfo represents memory usage information
type MemoryInfo struct {
	AllocMB      int64 `json:"alloc_mb"`
	SysMB        int64 `json:"sys_mb"`
	HeapAllocMB  int64 `json:"heap_alloc_mb"`
	HeapSysMB    int64 `json:"heap_sys_mb"`
	NumGC        uint32 `json:"num_gc"`
}

// NewServer creates a new metrics server
func NewServer(port int, serviceName, version, env string, logger zerolog.Logger) *Server {
	mux := http.NewServeMux()

	s := &Server{
		serviceName: serviceName,
		version:     version,
		env:         env,
		logger:      logger,
	}

	// Metrics endpoint (Prometheus format)
	mux.Handle("/metrics", Handler())

	// Health check endpoint
	mux.HandleFunc("/health", s.handleHealth)

	// Status endpoint (JSON format)
	mux.HandleFunc("/status", s.handleStatus)

	s.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	return s
}

// Start starts the metrics server
func (s *Server) Start() error {
	s.logger.Info().Str("addr", s.server.Addr).Msg("starting metrics server")
	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the metrics server
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info().Msg("shutting down metrics server")
	return s.server.Shutdown(ctx)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"service":   s.serviceName,
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	status := StatusResponse{
		Service:       s.serviceName,
		Status:        "ok",
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Env:           s.env,
		Version:       s.version,
		GoVersion:     runtime.Version(),
		UptimeSeconds: time.Since(startTime).Seconds(),
		Goroutines:    runtime.NumGoroutine(),
		Memory: MemoryInfo{
			AllocMB:     int64(m.Alloc / 1024 / 1024),
			SysMB:       int64(m.Sys / 1024 / 1024),
			HeapAllocMB: int64(m.HeapAlloc / 1024 / 1024),
			HeapSysMB:   int64(m.HeapSys / 1024 / 1024),
			NumGC:       m.NumGC,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// SetConfigInfo allows setting additional config info to be displayed in status
func (s *Server) SetConfigInfo(config map[string]string) {
	// This could be stored and shown in status responses
}
