package models

import (
	"testing"
	"time"
)

func TestCertificate_DaysUntilExpiry(t *testing.T) {
	tests := []struct {
		name     string
		notAfter time.Time
		wantMin  float64
		wantMax  float64
	}{
		{"30 days out", time.Now().Add(30 * 24 * time.Hour), 29.9, 30.1},
		{"already expired", time.Now().Add(-1 * 24 * time.Hour), -1.1, -0.9},
		{"today", time.Now(), -0.1, 0.1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Certificate{NotAfter: tt.notAfter}
			got := c.DaysUntilExpiry()
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("DaysUntilExpiry() = %f, want between %f and %f", got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestCertificate_IsExpired(t *testing.T) {
	tests := []struct {
		name     string
		notAfter time.Time
		want     bool
	}{
		{"future cert", time.Now().Add(24 * time.Hour), false},
		{"expired cert", time.Now().Add(-24 * time.Hour), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Certificate{NotAfter: tt.notAfter}
			if got := c.IsExpired(); got != tt.want {
				t.Errorf("IsExpired() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNewCertificate(t *testing.T) {
	c := NewCertificate("arn:aws:acm:us-east-1:123:cert/abc", CertificateSourceACM)

	if c.Identifier != "arn:aws:acm:us-east-1:123:cert/abc" {
		t.Errorf("Identifier = %q", c.Identifier)
	}
	if c.Source != CertificateSourceACM {
		t.Errorf("Source = %q, want %q", c.Source, CertificateSourceACM)
	}
	if c.AltNames == nil {
		t.Error("AltNames should be initialized")
	}
	if c.LastSeenAt.IsZero() {
		t.Error("LastSeenAt should be set")
	}
}
