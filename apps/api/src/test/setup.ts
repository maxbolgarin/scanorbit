import { vi, beforeEach } from 'vitest';

// Set test environment variables BEFORE any module imports
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-characters';
process.env.TOTP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.OAUTH_ENCRYPTION_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'fatal'; // Suppress logs during tests

beforeEach(() => {
  vi.clearAllMocks();
});
