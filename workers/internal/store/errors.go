package store

import (
	"regexp"
	"strings"
)

// Precompiled regexes for error sanitization (compiled at init to catch errors early)
var (
	awsCredsPattern     = regexp.MustCompile(`(?i)(aws_?access_?key_?id|aws_?secret_?access_?key|aws_?session_?token)\s*[=:]\s*['"]?[A-Za-z0-9/+=]+['"]?`)
	secretsPattern      = regexp.MustCompile(`(?i)(password|passwd|pwd|secret|token|api_?key|auth)\s*[=:]\s*['"]?[^\s'"]+['"]?`)
	awsAccessKeyPattern = regexp.MustCompile(`AKIA[0-9A-Z]{16}`)
	base64SecretPattern = regexp.MustCompile(`[a-zA-Z0-9/+=]{40}`)
	bearerTokenPattern  = regexp.MustCompile(`(?i)bearer\s+[a-zA-Z0-9\-._~+/]+=*`)
	postgresURLPattern  = regexp.MustCompile(`postgresql://[^@]+@`)
	redisURLPattern     = regexp.MustCompile(`redis://[^@]+@`)
	redissURLPattern    = regexp.MustCompile(`rediss://[^@]+@`)
	pemPattern          = regexp.MustCompile(`(?i)-{5}BEGIN[^-]+-{5}[\s\S]*?-{5}END`)
	filePathPattern     = regexp.MustCompile(`(/[a-zA-Z0-9_\-./]+){3,}`)
	ipAddressPattern    = regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)

	sanitizePatterns = []*regexp.Regexp{
		awsCredsPattern,
		secretsPattern,
		awsAccessKeyPattern,
		base64SecretPattern,
		bearerTokenPattern,
		postgresURLPattern,
		redisURLPattern,
		redissURLPattern,
		pemPattern,
	}
)

// SanitizeErrorMessage removes sensitive information from error messages
// before storing them in the database or exposing to users.
func SanitizeErrorMessage(err string) string {
	if err == "" {
		return ""
	}

	// Limit error message length
	const maxLength = 500
	if len(err) > maxLength {
		err = err[:maxLength] + "..."
	}

	// Remove potential credentials and secrets
	sanitized := err
	for _, pattern := range sanitizePatterns {
		sanitized = pattern.ReplaceAllString(sanitized, "[REDACTED]")
	}

	// Remove file paths that might expose system structure
	sanitized = filePathPattern.ReplaceAllString(sanitized, "[PATH]")

	// Remove IP addresses (replace all - localhost IPs in errors are fine to redact)
	sanitized = ipAddressPattern.ReplaceAllString(sanitized, "[IP]")

	// Map common internal errors to user-friendly messages
	errorMappings := map[string]string{
		"connection refused":        "service temporarily unavailable",
		"no such host":              "service temporarily unavailable",
		"i/o timeout":               "operation timed out",
		"context deadline exceeded": "operation timed out",
		"context canceled":          "operation was cancelled",
		"too many open files":       "service temporarily unavailable",
		"connection reset by peer":  "connection interrupted",
		"broken pipe":               "connection interrupted",
		"invalid memory address":    "internal error occurred",
		"runtime error":             "internal error occurred",
		"panic":                     "internal error occurred",
		"stack trace":               "internal error occurred",
		"goroutine":                 "internal error occurred",
		"permission denied":         "access denied",
		"access denied":             "access denied",
		"unauthorized":              "authentication failed",
		"forbidden":                 "access denied",
		"expired token":             "authentication expired",
		"invalid token":             "authentication failed",
		"assume role":               "AWS role assumption failed",
		"accessdenied":              "AWS access denied - check IAM permissions",
		"invalidclienttokenid":      "AWS credentials invalid",
		"expiredtoken":              "AWS session expired",
		"throttling":                "AWS rate limit exceeded",
		"serviceunavailable":        "AWS service temporarily unavailable",
		"internalerror":             "AWS internal error",
		"requestlimitexceeded":      "AWS request limit exceeded",
	}

	lowerSanitized := strings.ToLower(sanitized)
	for pattern, replacement := range errorMappings {
		if strings.Contains(lowerSanitized, pattern) {
			// Keep the user-friendly message but preserve some context
			if len(sanitized) > 100 {
				return replacement
			}
		}
	}

	return sanitized
}

// SanitizeErrorForUser provides a more aggressive sanitization for errors
// that will be directly shown to end users via API.
func SanitizeErrorForUser(err string) string {
	if err == "" {
		return ""
	}

	// First apply standard sanitization
	sanitized := SanitizeErrorMessage(err)

	// Map to high-level user-friendly messages
	lowerErr := strings.ToLower(sanitized)

	switch {
	case strings.Contains(lowerErr, "assume role") || strings.Contains(lowerErr, "sts"):
		return "Failed to access AWS account. Please verify the IAM role configuration."
	case strings.Contains(lowerErr, "access denied") || strings.Contains(lowerErr, "forbidden"):
		return "Access denied. Please check IAM permissions."
	case strings.Contains(lowerErr, "timeout") || strings.Contains(lowerErr, "timed out"):
		return "Operation timed out. Please try again."
	case strings.Contains(lowerErr, "unavailable"):
		return "Service temporarily unavailable. Please try again later."
	case strings.Contains(lowerErr, "rate limit") || strings.Contains(lowerErr, "throttl"):
		return "Rate limit exceeded. Please try again later."
	case strings.Contains(lowerErr, "authentication") || strings.Contains(lowerErr, "unauthorized"):
		return "Authentication failed. Please verify credentials."
	case strings.Contains(lowerErr, "internal error"):
		return "An internal error occurred. Please contact support if this persists."
	case strings.Contains(lowerErr, "connection"):
		return "Connection error. Please try again."
	default:
		// If message is still too technical, provide generic message
		if len(sanitized) > 200 || strings.Contains(sanitized, "error:") {
			return "An error occurred during processing."
		}
		return sanitized
	}
}
