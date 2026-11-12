/**
 * Unit tests for API Key Limit Configuration
 * Tests environment variable loading and limit calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMaxKeysPerUser } from '../../../src/config/api-key-limit.config.js';

describe('API Key Limit Configuration', () => {
  const originalEnv = process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER;

  beforeEach(() => {
    delete process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = originalEnv;
    } else {
      delete process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER;
    }
  });

  it('should return default value of 10 when env var is unset', () => {
    expect(getMaxKeysPerUser()).toBe(10);
  });

  it('should return parsed number when env var is set to valid value', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = '20';
    expect(getMaxKeysPerUser()).toBe(20);
  });

  it('should return parsed number for env var value 5', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = '5';
    expect(getMaxKeysPerUser()).toBe(5);
  });

  it('should return default 10 when env var is empty string', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = '';
    expect(getMaxKeysPerUser()).toBe(10);
  });

  it('should return default 10 when env var is invalid string', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = 'abc';
    expect(getMaxKeysPerUser()).toBe(10);
  });

  it('should return default 10 when env var is zero', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = '0';
    expect(getMaxKeysPerUser()).toBe(10);
  });

  it('should return parsed number for large value', () => {
    process.env.API_KEY_LIMIT_MAX_KEYS_PER_USER = '100';
    expect(getMaxKeysPerUser()).toBe(100);
  });
});
