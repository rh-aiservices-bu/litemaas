/**
 * Unit tests for Validation Utilities
 * Tests common validation functions used across services including subscription validation
 */

import { describe, it, expect } from 'vitest';
import { ValidationUtils } from '../../../src/utils/validation.utils';

describe('ValidationUtils', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(ValidationUtils.isValidEmail('user@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('test.user@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(ValidationUtils.isValidEmail('user_name@example-domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(ValidationUtils.isValidEmail('invalid')).toBe(false);
      expect(ValidationUtils.isValidEmail('user@')).toBe(false);
      expect(ValidationUtils.isValidEmail('@example.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('user @example.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('user@example')).toBe(false);
      expect(ValidationUtils.isValidEmail('')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(ValidationUtils.isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(ValidationUtils.isValidUUID('a0000000-0000-4000-8000-000000000001')).toBe(true);
      expect(ValidationUtils.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(ValidationUtils.isValidUUID('not-a-uuid')).toBe(false);
      expect(ValidationUtils.isValidUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Too short
      expect(ValidationUtils.isValidUUID('123e4567-e89b-12d3-a456-4266141740000')).toBe(false); // Too long
      expect(ValidationUtils.isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false); // No dashes
      expect(ValidationUtils.isValidUUID('')).toBe(false);
    });
  });

  describe('isValidModelId', () => {
    it('should validate correct model IDs', () => {
      expect(ValidationUtils.isValidModelId('gpt-4')).toBe(true);
      expect(ValidationUtils.isValidModelId('claude-3-opus')).toBe(true);
      expect(ValidationUtils.isValidModelId('gpt-3.5-turbo')).toBe(true);
      expect(ValidationUtils.isValidModelId('model_name_123')).toBe(true);
      expect(ValidationUtils.isValidModelId('text-davinci-003')).toBe(true);
    });

    it('should reject invalid model IDs', () => {
      expect(ValidationUtils.isValidModelId('')).toBe(false);
      expect(ValidationUtils.isValidModelId('model with spaces')).toBe(false);
      expect(ValidationUtils.isValidModelId('model@special')).toBe(false);
      expect(ValidationUtils.isValidModelId('a'.repeat(101))).toBe(false); // Too long
      expect(ValidationUtils.isValidModelId(null as any)).toBe(false);
      expect(ValidationUtils.isValidModelId(123 as any)).toBe(false);
    });
  });

  describe('isValidModelIdArray', () => {
    it('should validate arrays of valid model IDs', () => {
      expect(ValidationUtils.isValidModelIdArray(['gpt-4', 'claude-3-opus'])).toBe(true);
      expect(ValidationUtils.isValidModelIdArray(['gpt-3.5-turbo'])).toBe(true);
      expect(ValidationUtils.isValidModelIdArray(['model-1', 'model-2', 'model-3'])).toBe(true);
    });

    it('should reject invalid model ID arrays', () => {
      expect(ValidationUtils.isValidModelIdArray([])).toBe(false);
      expect(ValidationUtils.isValidModelIdArray(['gpt-4', 'invalid model'])).toBe(false);
      expect(ValidationUtils.isValidModelIdArray(['gpt-4', ''])).toBe(false);
      expect(ValidationUtils.isValidModelIdArray(null as any)).toBe(false);
      expect(ValidationUtils.isValidModelIdArray('not-an-array' as any)).toBe(false);
    });
  });

  describe('isValidBudget', () => {
    it('should validate correct budget amounts', () => {
      expect(ValidationUtils.isValidBudget(0)).toBe(true);
      expect(ValidationUtils.isValidBudget(100)).toBe(true);
      expect(ValidationUtils.isValidBudget(999999)).toBe(true);
      expect(ValidationUtils.isValidBudget(1000000)).toBe(true);
      expect(ValidationUtils.isValidBudget(0.5)).toBe(true);
    });

    it('should reject invalid budget amounts', () => {
      expect(ValidationUtils.isValidBudget(-1)).toBe(false);
      expect(ValidationUtils.isValidBudget(1000001)).toBe(false);
      expect(ValidationUtils.isValidBudget(NaN)).toBe(false);
      expect(ValidationUtils.isValidBudget(Infinity)).toBe(false);
      expect(ValidationUtils.isValidBudget('100' as any)).toBe(false);
    });
  });

  describe('isValidTPMLimit', () => {
    it('should validate correct TPM limits', () => {
      expect(ValidationUtils.isValidTPMLimit(0)).toBe(true);
      expect(ValidationUtils.isValidTPMLimit(10000)).toBe(true);
      expect(ValidationUtils.isValidTPMLimit(999999)).toBe(true);
      expect(ValidationUtils.isValidTPMLimit(1000000)).toBe(true);
    });

    it('should reject invalid TPM limits', () => {
      expect(ValidationUtils.isValidTPMLimit(-1)).toBe(false);
      expect(ValidationUtils.isValidTPMLimit(1000001)).toBe(false);
      expect(ValidationUtils.isValidTPMLimit(100.5)).toBe(false); // Must be integer
      expect(ValidationUtils.isValidTPMLimit(NaN)).toBe(false);
      expect(ValidationUtils.isValidTPMLimit('10000' as any)).toBe(false);
    });
  });

  describe('isValidRPMLimit', () => {
    it('should validate correct RPM limits', () => {
      expect(ValidationUtils.isValidRPMLimit(0)).toBe(true);
      expect(ValidationUtils.isValidRPMLimit(60)).toBe(true);
      expect(ValidationUtils.isValidRPMLimit(9999)).toBe(true);
      expect(ValidationUtils.isValidRPMLimit(10000)).toBe(true);
    });

    it('should reject invalid RPM limits', () => {
      expect(ValidationUtils.isValidRPMLimit(-1)).toBe(false);
      expect(ValidationUtils.isValidRPMLimit(10001)).toBe(false);
      expect(ValidationUtils.isValidRPMLimit(60.5)).toBe(false); // Must be integer
      expect(ValidationUtils.isValidRPMLimit(NaN)).toBe(false);
      expect(ValidationUtils.isValidRPMLimit('60' as any)).toBe(false);
    });
  });

  describe('isValidTeamName', () => {
    it('should validate correct team names', () => {
      expect(ValidationUtils.isValidTeamName('Engineering Team')).toBe(true);
      expect(ValidationUtils.isValidTeamName('Data-Science')).toBe(true);
      expect(ValidationUtils.isValidTeamName('Team_123')).toBe(true);
      expect(ValidationUtils.isValidTeamName('Marketing-2024')).toBe(true);
      expect(ValidationUtils.isValidTeamName('   Sales Team   ')).toBe(true); // Trimmed
    });

    it('should reject invalid team names', () => {
      expect(ValidationUtils.isValidTeamName('AB')).toBe(false); // Too short
      expect(ValidationUtils.isValidTeamName('a'.repeat(51))).toBe(false); // Too long
      expect(ValidationUtils.isValidTeamName('Team@Special')).toBe(false); // Invalid character
      expect(ValidationUtils.isValidTeamName('')).toBe(false);
      expect(ValidationUtils.isValidTeamName(null as any)).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(ValidationUtils.isValidUsername('john.doe')).toBe(true);
      expect(ValidationUtils.isValidUsername('user_123')).toBe(true);
      expect(ValidationUtils.isValidUsername('test-user')).toBe(true);
      expect(ValidationUtils.isValidUsername('JohnDoe2024')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(ValidationUtils.isValidUsername('ab')).toBe(false); // Too short
      expect(ValidationUtils.isValidUsername('a'.repeat(31))).toBe(false); // Too long
      expect(ValidationUtils.isValidUsername('user name')).toBe(false); // Space
      expect(ValidationUtils.isValidUsername('user@domain')).toBe(false); // Invalid character
      expect(ValidationUtils.isValidUsername('')).toBe(false);
      expect(ValidationUtils.isValidUsername(null as any)).toBe(false);
    });
  });

  describe('isValidApiKeyName', () => {
    it('should validate correct API key names', () => {
      expect(ValidationUtils.isValidApiKeyName('Production Key')).toBe(true);
      expect(ValidationUtils.isValidApiKeyName('dev-key-123')).toBe(true);
      expect(ValidationUtils.isValidApiKeyName('Test_Key')).toBe(true);
      expect(ValidationUtils.isValidApiKeyName('Key for CI/CD')).toBe(false); // Slash not allowed
      expect(ValidationUtils.isValidApiKeyName('   API Key   ')).toBe(true); // Trimmed
    });

    it('should reject invalid API key names', () => {
      expect(ValidationUtils.isValidApiKeyName('')).toBe(false);
      expect(ValidationUtils.isValidApiKeyName('a'.repeat(101))).toBe(false); // Too long
      expect(ValidationUtils.isValidApiKeyName('Key@Special')).toBe(false); // Invalid character
      expect(ValidationUtils.isValidApiKeyName(null as any)).toBe(false);
    });
  });

  describe('isDateInFuture', () => {
    it('should validate dates in the future', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      expect(ValidationUtils.isDateInFuture(futureDate)).toBe(true);

      const farFutureDate = new Date(Date.now() + 86400000 * 365); // One year from now
      expect(ValidationUtils.isDateInFuture(farFutureDate)).toBe(true);
    });

    it('should reject dates in the past or present', () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      expect(ValidationUtils.isDateInFuture(pastDate)).toBe(false);

      const now = new Date();
      expect(ValidationUtils.isDateInFuture(now)).toBe(false); // Equal to now is not future

      const invalidDate = new Date('invalid');
      expect(ValidationUtils.isDateInFuture(invalidDate)).toBe(false);
    });
  });

  describe('isValidSubscriptionStatus', () => {
    it('should validate correct subscription statuses', () => {
      expect(ValidationUtils.isValidSubscriptionStatus('pending')).toBe(true);
      expect(ValidationUtils.isValidSubscriptionStatus('active')).toBe(true);
      expect(ValidationUtils.isValidSubscriptionStatus('suspended')).toBe(true);
      expect(ValidationUtils.isValidSubscriptionStatus('cancelled')).toBe(true);
      expect(ValidationUtils.isValidSubscriptionStatus('expired')).toBe(true);
      expect(ValidationUtils.isValidSubscriptionStatus('inactive')).toBe(true);
    });

    it('should reject invalid subscription statuses', () => {
      expect(ValidationUtils.isValidSubscriptionStatus('ACTIVE')).toBe(false); // Case sensitive
      expect(ValidationUtils.isValidSubscriptionStatus('running')).toBe(false);
      expect(ValidationUtils.isValidSubscriptionStatus('paused')).toBe(false);
      expect(ValidationUtils.isValidSubscriptionStatus('')).toBe(false);
      expect(ValidationUtils.isValidSubscriptionStatus('unknown')).toBe(false);
    });
  });

  describe('isValidUserRole', () => {
    it('should validate correct user roles', () => {
      expect(ValidationUtils.isValidUserRole('user')).toBe(true);
      expect(ValidationUtils.isValidUserRole('admin')).toBe(true);
      expect(ValidationUtils.isValidUserRole('moderator')).toBe(true);
    });

    it('should reject invalid user roles', () => {
      expect(ValidationUtils.isValidUserRole('USER')).toBe(false); // Case sensitive
      expect(ValidationUtils.isValidUserRole('superadmin')).toBe(false);
      expect(ValidationUtils.isValidUserRole('')).toBe(false);
      expect(ValidationUtils.isValidUserRole('guest')).toBe(false);
    });
  });

  describe('isValidTeamMemberRole', () => {
    it('should validate correct team member roles', () => {
      expect(ValidationUtils.isValidTeamMemberRole('member')).toBe(true);
      expect(ValidationUtils.isValidTeamMemberRole('admin')).toBe(true);
      expect(ValidationUtils.isValidTeamMemberRole('owner')).toBe(true);
    });

    it('should reject invalid team member roles', () => {
      expect(ValidationUtils.isValidTeamMemberRole('MEMBER')).toBe(false); // Case sensitive
      expect(ValidationUtils.isValidTeamMemberRole('user')).toBe(false);
      expect(ValidationUtils.isValidTeamMemberRole('')).toBe(false);
      expect(ValidationUtils.isValidTeamMemberRole('viewer')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove potentially dangerous characters', () => {
      expect(ValidationUtils.sanitizeString('<script>alert("xss")</script>')).toBe(
        'scriptalert(xss)/script',
      );
      expect(ValidationUtils.sanitizeString('Hello "World"')).toBe('Hello World');
      expect(ValidationUtils.sanitizeString("It's a test")).toBe('Its a test');
    });

    it('should trim whitespace', () => {
      expect(ValidationUtils.sanitizeString('  test  ')).toBe('test');
      expect(ValidationUtils.sanitizeString('\n\tvalue\n\t')).toBe('value');
    });

    it('should respect maximum length', () => {
      expect(ValidationUtils.sanitizeString('a'.repeat(300), 100)).toBe('a'.repeat(100));
      expect(ValidationUtils.sanitizeString('test', 2)).toBe('te');
    });

    it('should use default max length of 255', () => {
      const longString = 'a'.repeat(300);
      expect(ValidationUtils.sanitizeString(longString).length).toBe(255);
    });

    it('should handle edge cases', () => {
      expect(ValidationUtils.sanitizeString('')).toBe('');
      expect(ValidationUtils.sanitizeString(null as any)).toBe('');
      expect(ValidationUtils.sanitizeString(undefined as any)).toBe('');
      expect(ValidationUtils.sanitizeString(123 as any)).toBe('');
    });
  });

  describe('validateAndSanitizeMetadata', () => {
    it('should validate and sanitize valid metadata', () => {
      const metadata = {
        key1: 'value1',
        key2: 123,
        key3: true,
      };

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(result).toEqual({
        key1: 'value1',
        key2: 123,
        key3: true,
      });
    });

    it('should sanitize string values in metadata', () => {
      const metadata = {
        name: '<script>test</script>',
        description: 'Valid description',
      };

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(result?.name).toBe('scripttest/script');
      expect(result?.description).toBe('Valid description');
    });

    it('should skip invalid value types', () => {
      const metadata = {
        valid: 'string',
        array: [1, 2, 3],
        object: { nested: 'value' },
        func: () => {},
        undef: undefined,
        nul: null,
      };

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(result).toEqual({
        valid: 'string',
      });
    });

    it('should limit number of keys to 20', () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 30; i++) {
        metadata[`key${i}`] = `value${i}`;
      }

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(Object.keys(result || {}).length).toBe(20);
    });

    it('should skip keys longer than 50 characters', () => {
      const metadata = {
        validKey: 'value',
        ['a'.repeat(51)]: 'should be skipped',
      };

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(result).toEqual({
        validKey: 'value',
      });
    });

    it('should limit string values to 500 characters', () => {
      const longValue = 'a'.repeat(600);
      const metadata = {
        longString: longValue,
      };

      const result = ValidationUtils.validateAndSanitizeMetadata(metadata);

      expect(result?.longString).toBe('a'.repeat(500));
    });

    it('should return null for invalid metadata types', () => {
      expect(ValidationUtils.validateAndSanitizeMetadata(null)).toBe(null);
      expect(ValidationUtils.validateAndSanitizeMetadata(undefined)).toBe(null);
      expect(ValidationUtils.validateAndSanitizeMetadata('not an object')).toBe(null);
      expect(ValidationUtils.validateAndSanitizeMetadata([1, 2, 3])).toBe(null);
    });

    it('should handle empty metadata object', () => {
      const result = ValidationUtils.validateAndSanitizeMetadata({});

      expect(result).toEqual({});
    });
  });

  describe('Integration - Subscription Validation', () => {
    it('should validate complete subscription data', () => {
      const subscriptionData = {
        status: 'active',
        budget: 1000,
        tpmLimit: 50000,
        rpmLimit: 500,
        modelIds: ['gpt-4', 'claude-3-opus'],
      };

      expect(ValidationUtils.isValidSubscriptionStatus(subscriptionData.status)).toBe(true);
      expect(ValidationUtils.isValidBudget(subscriptionData.budget)).toBe(true);
      expect(ValidationUtils.isValidTPMLimit(subscriptionData.tpmLimit)).toBe(true);
      expect(ValidationUtils.isValidRPMLimit(subscriptionData.rpmLimit)).toBe(true);
      expect(ValidationUtils.isValidModelIdArray(subscriptionData.modelIds)).toBe(true);
    });

    it('should detect invalid subscription data', () => {
      const invalidSubscription = {
        status: 'invalid-status',
        budget: -100,
        tpmLimit: 2000000, // Exceeds max
        rpmLimit: 20000, // Exceeds max
        modelIds: ['gpt-4', 'invalid model id'],
      };

      expect(ValidationUtils.isValidSubscriptionStatus(invalidSubscription.status)).toBe(false);
      expect(ValidationUtils.isValidBudget(invalidSubscription.budget)).toBe(false);
      expect(ValidationUtils.isValidTPMLimit(invalidSubscription.tpmLimit)).toBe(false);
      expect(ValidationUtils.isValidRPMLimit(invalidSubscription.rpmLimit)).toBe(false);
      expect(ValidationUtils.isValidModelIdArray(invalidSubscription.modelIds)).toBe(false);
    });
  });
});
