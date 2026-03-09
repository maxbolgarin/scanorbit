import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import { readSecret, readRequiredSecret } from '../../lib/secrets.js';
import { readFileSync } from 'fs';

describe('readSecret', () => {
  beforeEach(() => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
  });

  it('reads from file when available', () => {
    vi.mocked(readFileSync).mockReturnValue('  file-secret-value  \n');
    const result = readSecret('MY_SECRET', 'my_secret');
    expect(result).toBe('file-secret-value');
    expect(readFileSync).toHaveBeenCalledWith('/run/secrets/my_secret', 'utf8');
  });

  it('falls back to environment variable', () => {
    process.env.TEST_SECRET_KEY = 'env-value';
    const result = readSecret('TEST_SECRET_KEY', 'test_secret');
    expect(result).toBe('env-value');
    delete process.env.TEST_SECRET_KEY;
  });

  it('falls back to default value', () => {
    const result = readSecret('NONEXISTENT_KEY_XYZ', 'nonexistent', 'default-val');
    expect(result).toBe('default-val');
  });

  it('returns empty string when no default provided', () => {
    const result = readSecret('NONEXISTENT_KEY_XYZ_2', 'nonexistent2');
    expect(result).toBe('');
  });
});

describe('readRequiredSecret', () => {
  beforeEach(() => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
  });

  it('reads from file when available', () => {
    vi.mocked(readFileSync).mockReturnValue('  file-secret  \n');
    const result = readRequiredSecret('MY_SECRET', 'my_secret', 'dev-default');
    expect(result).toBe('file-secret');
  });

  it('falls back to environment variable', () => {
    process.env.TEST_REQUIRED_SECRET = 'env-required';
    const result = readRequiredSecret('TEST_REQUIRED_SECRET', 'test_required', 'dev-default');
    expect(result).toBe('env-required');
    delete process.env.TEST_REQUIRED_SECRET;
  });

  it('returns dev default in non-production', () => {
    const result = readRequiredSecret('NONEXISTENT_REQUIRED_KEY', 'nonexistent', 'dev-fallback');
    expect(result).toBe('dev-fallback');
  });

  it('throws in production when secret is missing', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => readRequiredSecret('NONEXISTENT_PROD_KEY', 'nonexistent_prod', 'dev-default'))
        .toThrow("Secret 'nonexistent_prod' (env: NONEXISTENT_PROD_KEY) is required in production");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
