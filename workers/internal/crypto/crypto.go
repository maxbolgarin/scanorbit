package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
)

// Decryptor handles AES-256-GCM decryption of encrypted values.
type Decryptor struct {
	key []byte
}

// NewDecryptor creates a new Decryptor with the given hex-encoded key.
// The key must be 64 hex characters (32 bytes) for AES-256.
func NewDecryptor(hexKey string) (*Decryptor, error) {
	if hexKey == "" {
		return nil, errors.New("encryption key is required")
	}
	if len(hexKey) != 64 {
		return nil, errors.New("encryption key must be 64 hex characters (32 bytes)")
	}

	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, errors.New("invalid hex encryption key")
	}

	return &Decryptor{key: key}, nil
}

// DecryptExternalID decrypts an external ID encrypted with AES-256-GCM.
// The encrypted format is: iv:authTag:ciphertext (all base64 encoded).
// If the value doesn't look encrypted (no colons or wrong format), returns it as-is.
func (d *Decryptor) DecryptExternalID(encrypted string) (string, error) {
	if encrypted == "" {
		return "", nil
	}

	// Check if it looks like encrypted format (iv:authTag:ciphertext)
	parts := strings.Split(encrypted, ":")
	if len(parts) != 3 {
		// Not encrypted, return as-is (backward compatibility)
		return encrypted, nil
	}

	// Validate that all parts look like base64
	for _, part := range parts {
		if !isBase64(part) {
			// Not encrypted, return as-is
			return encrypted, nil
		}
	}

	// Decode base64 parts
	iv, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return encrypted, nil // Not valid base64, return as-is
	}

	authTag, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return encrypted, nil
	}

	ciphertext, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		return encrypted, nil
	}

	// Create AES cipher
	block, err := aes.NewCipher(d.key)
	if err != nil {
		return "", err
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// In GCM, the auth tag is appended to ciphertext for decryption
	ciphertextWithTag := append(ciphertext, authTag...)

	// Decrypt
	plaintext, err := gcm.Open(nil, iv, ciphertextWithTag, nil)
	if err != nil {
		// Decryption failed, might be legacy unencrypted value
		return encrypted, nil
	}

	return string(plaintext), nil
}

// isBase64 checks if a string looks like valid base64.
func isBase64(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
			return false
		}
	}
	return true
}
