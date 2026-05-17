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
    const result = readRequiredSecret('MY_SECRET', 'my_secret');
    expect(result).toBe('file-secret');
  });

  it('falls back to environment variable', () => {
    process.env.TEST_REQUIRED_SECRET = 'env-required';
    const result = readRequiredSecret('TEST_REQUIRED_SECRET', 'test_required');
    expect(result).toBe('env-required');
    delete process.env.TEST_REQUIRED_SECRET;
  });

  it('throws when neither file nor env var is set', () => {
    expect(() => readRequiredSecret('NONEXISTENT_REQUIRED_KEY', 'nonexistent'))
      .toThrow(/NONEXISTENT_REQUIRED_KEY is required/);
  });

  it('throws regardless of NODE_ENV', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => readRequiredSecret('NONEXISTENT_PROD_KEY', 'nonexistent_prod'))
        .toThrow(/NONEXISTENT_PROD_KEY is required/);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
