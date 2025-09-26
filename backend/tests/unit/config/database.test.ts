/**
 * Unit tests for Database configuration
 * Tests database configuration plugin and environment variable handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import databaseConfig from '../../../src/config/database.js';

describe('Database Configuration', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    // Close Fastify instance if it was created
    if (app) {
      await app.close();
    }
  });

  describe('Fastify Plugin Integration', () => {
    it('should register as Fastify plugin', async () => {
      await expect(app.register(databaseConfig)).resolves.not.toThrow();
    });

    it('should decorate Fastify instance with dbConfig', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toBeDefined();
      expect(typeof app.dbConfig).toBe('object');
    });

    it('should provide connectionString property', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toHaveProperty('connectionString');
      expect(typeof app.dbConfig.connectionString).toBe('string');
    });

    it('should provide ssl property', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toHaveProperty('ssl');
      expect(typeof app.dbConfig.ssl).toBe('boolean');
    });

    it('should provide maxConnections property', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toHaveProperty('maxConnections');
      expect(typeof app.dbConfig.maxConnections).toBe('number');
    });

    it('should provide idleTimeoutMillis property', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toHaveProperty('idleTimeoutMillis');
      expect(typeof app.dbConfig.idleTimeoutMillis).toBe('number');
    });

    it('should provide connectionTimeoutMillis property', async () => {
      await app.register(databaseConfig);

      expect(app.dbConfig).toHaveProperty('connectionTimeoutMillis');
      expect(typeof app.dbConfig.connectionTimeoutMillis).toBe('number');
    });
  });

  describe('Configuration Properties', () => {
    beforeEach(async () => {
      await app.register(databaseConfig);
    });

    it('should have valid connectionString format', () => {
      // Should be a PostgreSQL connection string
      expect(app.dbConfig.connectionString).toMatch(/^postgresql:\/\//);
    });

    it('should have non-negative maxConnections', () => {
      expect(app.dbConfig.maxConnections).toBeGreaterThanOrEqual(0);
    });

    it('should have non-negative idleTimeoutMillis', () => {
      expect(app.dbConfig.idleTimeoutMillis).toBeGreaterThanOrEqual(0);
    });

    it('should have non-negative connectionTimeoutMillis', () => {
      expect(app.dbConfig.connectionTimeoutMillis).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SSL Configuration Logic', () => {
    it('should have ssl as boolean value', async () => {
      await app.register(databaseConfig);

      expect(typeof app.dbConfig.ssl).toBe('boolean');
    });

    it('should handle production and non-production environments', async () => {
      await app.register(databaseConfig);

      // SSL should be enabled in production, disabled otherwise
      const isProduction = process.env.NODE_ENV === 'production';
      expect(app.dbConfig.ssl).toBe(isProduction);
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required database configuration properties', async () => {
      await app.register(databaseConfig);

      const requiredProps = [
        'connectionString',
        'ssl',
        'maxConnections',
        'idleTimeoutMillis',
        'connectionTimeoutMillis',
      ];

      requiredProps.forEach((prop) => {
        expect(app.dbConfig).toHaveProperty(prop);
      });
    });

    it('should not have unexpected properties', async () => {
      await app.register(databaseConfig);

      const expectedKeys = [
        'connectionString',
        'ssl',
        'maxConnections',
        'idleTimeoutMillis',
        'connectionTimeoutMillis',
      ];
      const actualKeys = Object.keys(app.dbConfig);

      actualKeys.forEach((key) => {
        expect(expectedKeys).toContain(key);
      });
    });
  });

  describe('Type Safety', () => {
    it('should have correct types for all properties', async () => {
      await app.register(databaseConfig);

      expect(typeof app.dbConfig.connectionString).toBe('string');
      expect(typeof app.dbConfig.ssl).toBe('boolean');
      expect(typeof app.dbConfig.maxConnections).toBe('number');
      expect(typeof app.dbConfig.idleTimeoutMillis).toBe('number');
      expect(typeof app.dbConfig.connectionTimeoutMillis).toBe('number');
    });

    it('should have finite numeric values', async () => {
      await app.register(databaseConfig);

      expect(Number.isFinite(app.dbConfig.maxConnections)).toBe(true);
      expect(Number.isFinite(app.dbConfig.idleTimeoutMillis)).toBe(true);
      expect(Number.isFinite(app.dbConfig.connectionTimeoutMillis)).toBe(true);
    });
  });
});
