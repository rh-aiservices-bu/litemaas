import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService } from '../../../src/services/oauth.service.js';
import { FastifyInstance } from 'fastify';

// Mock Fastify instance
const createMockFastify = () =>
  ({
    dbUtils: {
      queryOne: vi.fn(),
      query: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }) as unknown as FastifyInstance;

describe('OAuthService', () => {
  let service: OAuthService;
  let mockFastify: FastifyInstance;
  let mockLiteLLMService: any;
  let mockDefaultTeamService: any;

  beforeEach(() => {
    mockFastify = createMockFastify();
    mockLiteLLMService = {
      createUser: vi.fn(),
    };
    mockDefaultTeamService = {
      ensureUserMembership: vi.fn(),
    };

    service = new OAuthService(mockFastify, mockLiteLLMService, mockDefaultTeamService);
  });

  describe('mapGroupsToRoles', () => {
    it('should map litemaas-admins to admin and user roles', () => {
      // Access private method for testing
      const result = (service as any).mapGroupsToRoles(['litemaas-admins']);
      expect(result).toEqual(['user', 'admin']);
    });

    it('should map litemaas-readonly to admin-readonly and user roles', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-readonly']);
      expect(result).toEqual(['user', 'admin-readonly']);
    });

    it('should map litemaas-users to user role only', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-users']);
      expect(result).toEqual(['user']);
    });

    it('should handle multiple groups correctly', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-admins', 'litemaas-readonly']);
      expect(result).toContain('user');
      expect(result).toContain('admin');
      expect(result).toContain('admin-readonly');
      expect(result).toHaveLength(3);
    });

    it('should return user role for unknown groups', () => {
      const result = (service as any).mapGroupsToRoles(['unknown-group']);
      expect(result).toEqual(['user']);
    });

    it('should return user role for empty groups array', () => {
      const result = (service as any).mapGroupsToRoles([]);
      expect(result).toEqual(['user']);
    });

    it('should always include user role as base', () => {
      const testCases = [
        ['litemaas-admins'],
        ['litemaas-readonly'],
        ['developers'],
        ['viewers'],
        ['unknown-group'],
        [],
      ];

      testCases.forEach((groups) => {
        const result = (service as any).mapGroupsToRoles(groups);
        expect(result).toContain('user');
      });
    });
  });

  describe('mergeRoles', () => {
    it('should preserve existing application-set roles', () => {
      const existingRoles = ['admin', 'customRole'];
      const openShiftRoles = ['user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin');
      expect(result).toContain('customRole');
      expect(result).toContain('user');
    });

    it('should add new OpenShift roles to existing roles', () => {
      const existingRoles = ['user'];
      const openShiftRoles = ['admin-readonly', 'user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user');
      expect(result).toContain('admin-readonly');
      expect(result).toHaveLength(2);
    });

    it('should handle empty existing roles', () => {
      const existingRoles: string[] = [];
      const openShiftRoles = ['admin-readonly', 'user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user');
      expect(result).toContain('admin-readonly');
    });

    it('should handle empty OpenShift roles', () => {
      const existingRoles = ['admin', 'customRole'];
      const openShiftRoles: string[] = [];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user'); // Always ensure user role
      expect(result).toContain('admin');
      expect(result).toContain('customRole');
    });

    it('should deduplicate roles', () => {
      const existingRoles = ['user', 'admin'];
      const openShiftRoles = ['user', 'admin-readonly'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result.filter((role) => role === 'user')).toHaveLength(1);
      expect(result).toContain('admin');
      expect(result).toContain('admin-readonly');
    });

    it('should always ensure user role is present', () => {
      const testCases = [
        [['admin'], ['admin-readonly']],
        [['customRole'], ['anotherCustomRole']],
        [[], []],
        [['admin'], []],
        [[], ['admin-readonly']],
      ];

      testCases.forEach(([existingRoles, openShiftRoles]) => {
        const result = (service as any).mergeRoles(existingRoles, openShiftRoles);
        expect(result).toContain('user');
      });
    });

    it('should handle application-set admin role with OpenShift user group', () => {
      // Scenario: User was manually made admin but OpenShift only has them in litemaas-users
      const existingRoles = ['admin', 'user'];
      const openShiftRoles = ['user']; // Only user from litemaas-users group

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin'); // Should preserve admin role
      expect(result).toContain('user');
      expect(result).toHaveLength(2);
    });

    it('should handle user promoted in OpenShift but not yet in application', () => {
      // Scenario: User added to litemaas-admins group, should get admin role
      const existingRoles = ['user'];
      const openShiftRoles = ['admin', 'user']; // From litemaas-admins group

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin'); // Should get admin role
      expect(result).toContain('user');
      expect(result).toHaveLength(2);
    });
  });
});
