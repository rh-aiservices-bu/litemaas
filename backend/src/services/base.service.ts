import { FastifyInstance } from 'fastify';

/**
 * Abstract base service class that provides common functionality for all services.
 * This includes mock data handling patterns that are shared across multiple services.
 */
export abstract class BaseService {
  protected fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Determines whether to use mock data based on database availability
   * @returns true if mock data should be used, false otherwise
   */
  protected shouldUseMockData(): boolean {
    const dbUnavailable = this.isDatabaseUnavailable();

    this.fastify.log.debug(
      {
        dbUnavailable,
        nodeEnv: process.env.NODE_ENV,
        hasPg: !!this.fastify.pg,
        mockMode: this.fastify.isDatabaseMockMode ? this.fastify.isDatabaseMockMode() : undefined,
      },
      `${this.constructor.name}: Checking if should use mock data`,
    );

    return dbUnavailable;
  }

  /**
   * Checks if the database is unavailable
   * @returns true if database is unavailable, false otherwise
   */
  protected isDatabaseUnavailable(): boolean {
    try {
      if (!this.fastify.pg) {
        this.fastify.log.debug(`${this.constructor.name}: PostgreSQL plugin not available`);
        return true;
      }

      if (this.fastify.isDatabaseMockMode && this.fastify.isDatabaseMockMode()) {
        this.fastify.log.debug(`${this.constructor.name}: Database mock mode enabled`);
        return true;
      }

      return false;
    } catch (error) {
      this.fastify.log.debug(
        { error },
        `${this.constructor.name}: Error checking database availability`,
      );
      return true;
    }
  }

  /**
   * Creates a mock response with simulated network delay
   * @param data The data to return in the mock response
   * @returns Promise that resolves to the data after a delay
   */
  protected createMockResponse<T>(data: T): Promise<T> {
    const delay = Math.random() * 200 + 100; // 100-300ms
    return new Promise((resolve) => setTimeout(() => resolve(data), delay));
  }
}
