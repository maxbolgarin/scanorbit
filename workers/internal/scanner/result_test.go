package scanner

import (
	"errors"
	"testing"
	"time"
)

func TestScanResult_HasErrors(t *testing.T) {
	t.Run("no errors", func(t *testing.T) {
		r := &ScanResult{}
		if r.HasErrors() {
			t.Error("expected false")
		}
	})
	t.Run("with errors", func(t *testing.T) {
		r := &ScanResult{Errors: []error{errors.New("fail")}}
		if !r.HasErrors() {
			t.Error("expected true")
		}
	})
}

func TestScanResult_ErrorCount(t *testing.T) {
	r := &ScanResult{Errors: []error{errors.New("a"), errors.New("b")}}
	if r.ErrorCount() != 2 {
		t.Errorf("ErrorCount() = %d, want 2", r.ErrorCount())
	}
}

func TestScanResult_Duration(t *testing.T) {
	start := time.Now()
	end := start.Add(5 * time.Minute)
	r := &ScanResult{StartedAt: start, CompletedAt: end}
	if d := r.Duration(); d != 5*time.Minute {
		t.Errorf("Duration() = %v, want 5m", d)
	}
}
