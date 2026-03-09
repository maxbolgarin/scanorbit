package store

import (
	"strings"
	"testing"
)

func TestSanitizeErrorMessage_Empty(t *testing.T) {
	if got := SanitizeErrorMessage(""); got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

func TestSanitizeErrorMessage_Truncation(t *testing.T) {
	long := strings.Repeat("a", 600)
	got := SanitizeErrorMessage(long)
	if len(got) > 503 { // 500 + "..."
		t.Errorf("expected truncated to <= 503 chars, got %d", len(got))
	}
	if !strings.HasSuffix(got, "...") {
		t.Errorf("expected truncated message to end with '...', got %q", got[len(got)-10:])
	}
}

func TestSanitizeErrorMessage_AWSCredentials(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{"access key ID", "error: aws_access_key_id=AKIAIOSFODNN7EXAMPLE"},
		{"secret key", "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"},
		{"session token", "aws_session_token=FwoGZXIvYXdzEBY"},
		{"bearer token", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test"},
		{"AKIA pattern", "found key AKIAIOSFODNN7EXAMPLE in config"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeErrorMessage(tt.input)
			if strings.Contains(got, "AKIA") || strings.Contains(got, "wJalr") || strings.Contains(got, "Bearer eyJ") {
				t.Errorf("sensitive data not redacted: %q", got)
			}
		})
	}
}

func TestSanitizeErrorMessage_DatabaseURLs(t *testing.T) {
	tests := []struct {
		name  string
		input string
		notContain string
	}{
		{"postgres URL", "connect to postgresql://user:pass@host:5432/db failed", "user:pass"},
		{"redis URL", "redis://admin:secret@redis.host:6379 connection refused", "admin:secret"},
		{"rediss URL", "rediss://admin:secret@redis.host:6380 timeout", "admin:secret"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeErrorMessage(tt.input)
			if strings.Contains(got, tt.notContain) {
				t.Errorf("URL credentials not redacted: %q", got)
			}
		})
	}
}

func TestSanitizeErrorMessage_IPAddresses(t *testing.T) {
	got := SanitizeErrorMessage("connection to 192.168.1.100 refused")
	if strings.Contains(got, "192.168.1.100") {
		t.Errorf("IP address not redacted: %q", got)
	}
	if !strings.Contains(got, "[IP]") {
		t.Errorf("expected [IP] placeholder, got: %q", got)
	}
}

func TestSanitizeErrorMessage_FilePaths(t *testing.T) {
	got := SanitizeErrorMessage("error reading /home/user/app/config/secrets.yml")
	if strings.Contains(got, "/home/user/app") {
		t.Errorf("file path not redacted: %q", got)
	}
}

func TestSanitizeErrorMessage_ErrorMapping(t *testing.T) {
	// Error mapping only kicks in for messages > 100 chars after sanitization.
	// Use words with spaces to avoid being caught by base64/secrets patterns.
	longPrefix := strings.Repeat("some error detail. ", 6) // ~114 chars

	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{"connection refused", longPrefix + "connection refused", "service temporarily unavailable"},
		{"context deadline", longPrefix + "context deadline exceeded", "operation timed out"},
		{"assume role", longPrefix + "failed to assume role", "AWS role assumption failed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeErrorMessage(tt.input)
			if got != tt.expect {
				t.Errorf("got %q, want %q", got, tt.expect)
			}
		})
	}
}

func TestSanitizeErrorForUser_Empty(t *testing.T) {
	if got := SanitizeErrorForUser(""); got != "" {
		t.Errorf("expected empty, got %q", got)
	}
}

func TestSanitizeErrorForUser_AssumeRole(t *testing.T) {
	got := SanitizeErrorForUser("failed to assume role arn:aws:iam::123456:role/test: AccessDenied")
	want := "Failed to access AWS account. Please verify the IAM role configuration."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSanitizeErrorForUser_Timeout(t *testing.T) {
	got := SanitizeErrorForUser("operation timed out waiting for response")
	want := "Operation timed out. Please try again."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSanitizeErrorForUser_RateLimit(t *testing.T) {
	got := SanitizeErrorForUser("throttling: rate limit exceeded")
	want := "Rate limit exceeded. Please try again later."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSanitizeErrorForUser_LongTechnical(t *testing.T) {
	long := "error: " + strings.Repeat("technical detail ", 20)
	got := SanitizeErrorForUser(long)
	want := "An error occurred during processing."
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestSanitizeErrorForUser_ShortSimple(t *testing.T) {
	got := SanitizeErrorForUser("scan failed")
	// Short non-matching messages pass through after sanitization
	if got == "" {
		t.Error("expected non-empty result")
	}
}
