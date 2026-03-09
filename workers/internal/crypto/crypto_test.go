package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"testing"
)

func validHexKey(t *testing.T) string {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(key)
}

// encrypt is a test helper that encrypts plaintext using AES-256-GCM
// in the same format the Decryptor expects: iv:authTag:ciphertext (base64).
func encrypt(t *testing.T, hexKey, plaintext string) string {
	t.Helper()
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		t.Fatal(err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		t.Fatal(err)
	}
	sealed := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	// sealed = ciphertext + authTag
	ciphertext := sealed[:len(sealed)-gcm.Overhead()]
	authTag := sealed[len(sealed)-gcm.Overhead():]

	return base64.StdEncoding.EncodeToString(nonce) + ":" +
		base64.StdEncoding.EncodeToString(authTag) + ":" +
		base64.StdEncoding.EncodeToString(ciphertext)
}

func TestNewDecryptor_EmptyKey(t *testing.T) {
	_, err := NewDecryptor("")
	if err == nil {
		t.Fatal("expected error for empty key")
	}
}

func TestNewDecryptor_ShortKey(t *testing.T) {
	_, err := NewDecryptor("aabbcc")
	if err == nil {
		t.Fatal("expected error for short key")
	}
}

func TestNewDecryptor_InvalidHex(t *testing.T) {
	_, err := NewDecryptor(strings.Repeat("zz", 32))
	if err == nil {
		t.Fatal("expected error for invalid hex")
	}
}

func TestNewDecryptor_Valid(t *testing.T) {
	d, err := NewDecryptor(validHexKey(t))
	if err != nil {
		t.Fatal(err)
	}
	if d == nil {
		t.Fatal("expected non-nil decryptor")
	}
}

func TestDecryptExternalID_Empty(t *testing.T) {
	d, _ := NewDecryptor(validHexKey(t))
	got, err := d.DecryptExternalID("")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty, got %q", got)
	}
}

func TestDecryptExternalID_PlainValue(t *testing.T) {
	d, _ := NewDecryptor(validHexKey(t))
	// No colons, returned as-is
	got, err := d.DecryptExternalID("plain-external-id")
	if err != nil {
		t.Fatal(err)
	}
	if got != "plain-external-id" {
		t.Errorf("expected pass-through, got %q", got)
	}
}

func TestDecryptExternalID_NonBase64Parts(t *testing.T) {
	d, _ := NewDecryptor(validHexKey(t))
	// Has 3 parts but not base64
	got, err := d.DecryptExternalID("not:base64:here!")
	if err != nil {
		t.Fatal(err)
	}
	if got != "not:base64:here!" {
		t.Errorf("expected pass-through for non-base64 parts, got %q", got)
	}
}

func TestDecryptExternalID_RoundTrip(t *testing.T) {
	hexKey := validHexKey(t)
	d, err := NewDecryptor(hexKey)
	if err != nil {
		t.Fatal(err)
	}

	plaintext := "my-secret-external-id-12345"
	encrypted := encrypt(t, hexKey, plaintext)

	got, err := d.DecryptExternalID(encrypted)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if got != plaintext {
		t.Errorf("got %q, want %q", got, plaintext)
	}
}

func TestDecryptExternalID_WrongKey(t *testing.T) {
	key1 := validHexKey(t)
	key2 := validHexKey(t)

	encrypted := encrypt(t, key1, "secret")

	d, _ := NewDecryptor(key2)
	_, err := d.DecryptExternalID(encrypted)
	if err == nil {
		t.Fatal("expected error when decrypting with wrong key")
	}
	if !strings.Contains(err.Error(), "authentication failed") {
		t.Errorf("error = %q, want authentication failed", err)
	}
}

func TestIsBase64(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"", false},
		{"abc123", true},
		{"abc+/=", true},
		{"abc def", false},
		{"abc!@#", false},
	}

	for _, tt := range tests {
		if got := isBase64(tt.input); got != tt.want {
			t.Errorf("isBase64(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
