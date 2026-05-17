import { describe, it, expect } from 'vitest';
import {
  HTTPError,
  HTTP400Error,
  HTTP401Error,
  HTTP403Error,
  HTTP404Error,
  HTTP409Error,
  HTTP429Error,
  HTTP500Error,
  HTTP503Error,
} from '../../lib/errors.js';

describe('HTTPError classes', () => {
  it.each([
    [HTTP400Error, 400, 'HTTP400Error', 'Bad Request'],
    [HTTP401Error, 401, 'HTTP401Error', 'Unauthorized'],
    [HTTP403Error, 403, 'HTTP403Error', 'Forbidden'],
    [HTTP404Error, 404, 'HTTP404Error', 'Not Found'],
    [HTTP409Error, 409, 'HTTP409Error', 'Conflict'],
    [HTTP429Error, 429, 'HTTP429Error', 'Too Many Requests'],
    [HTTP500Error, 500, 'HTTP500Error', 'Internal Server Error'],
    [HTTP503Error, 503, 'HTTP503Error', 'Service Unavailable'],
  ] as const)('%s has statusCode %d', (ErrorClass, statusCode, name, defaultMsg) => {
    const error = new ErrorClass();
    expect(error).toBeInstanceOf(HTTPError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(statusCode);
    expect(error.name).toBe(name);
    expect(error.message).toBe(defaultMsg);
  });

  it('accepts custom message', () => {
    const error = new HTTP400Error('Custom validation error');
    expect(error.message).toBe('Custom validation error');
    expect(error.statusCode).toBe(400);
  });

  it('base HTTPError works with arbitrary status code', () => {
    const error = new HTTPError(418, "I'm a teapot");
    expect(error.statusCode).toBe(418);
    expect(error.message).toBe("I'm a teapot");
    expect(error.name).toBe('HTTPError');
  });
});
