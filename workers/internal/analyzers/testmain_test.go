package analyzers

import (
	"os"
	"testing"

	"github.com/maxbolgarin/scanorbit/internal/metrics"
)

func TestMain(m *testing.M) {
	metrics.Init(metrics.Config{
		ServiceName: "test",
		Environment: "test",
		Version:     "0.0.0",
	})
	os.Exit(m.Run())
}
