import { FastifyInstance } from 'fastify';
import { ApplicationError } from '../utils/errors';
import { ValidationUtils } from '../utils/validation.utils';

/**
 * Abstract base service class that provides common functionality for all services.
 * This includes mock data handling patterns and comprehensive error handling methods
 * that are shared across multiple services.
 *
 * @example Using the enhanced error handling methods:
 * ```typescript
 * class UserService extends BaseService {
 *   async createUser(userData: CreateUserDto): Promise<User> {
 *     try {
 *       // Validate required fields
 *       this.validateRequiredFields(userData, ['email', 'username']);
 *
 *       // Validate specific formats
 *       this.validateEmail(userData.email);
 *       this.validateUUID(userData.teamId, 'teamId');
 *
 *       // Execute database operation with error handling
 *       const result = await this.executeQueryOne(
 *         'INSERT INTO users (email, username, team_id) VALUES ($1, $2, $3) RETURNING *',
 *         [userData.email, userData.username, userData.teamId],
 *         'creating user'
 *       );
 *
 *       return result;
 *     } catch (error) {
 *       // Database errors are automatically mapped to ApplicationErrors
 *       // Validation errors are automatically created with proper context
 *       throw error; // Re-throw as ApplicationError
 *     }
 *   }
 *
 *   async getUser(userId: string): Promise<User> {
 *     this.validateUUID(userId, 'userId');
 *
 *     const user = await this.executeQueryOne(
 *       'SELECT * FROM users WHERE id = $1 AND is_active = true',
 *       [userId],
 *       'getting user'
 *     );
 *
 *     // Ensure resource exists with helpful error message
 *     this.ensureResourceExists(user, 'User', userId);
 *
 *     return user;
 *   }
 *
 *   async updateUser(userId: string, updateData: UpdateUserDto, requestingUserId: string): Promise<User> {
 *     const user = await this.getUser(userId);
 *
 *     // Check access permissions
 *     const hasAccess = user.id === requestingUserId || await this.isAdmin(requestingUserId);
 *     this.ensureResourceAccess(hasAccess, 'User', 'admin or owner');
 *
 *     const updated = await this.executeQueryOne(
 *       'UPDATE users SET email = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
 *       [userId, updateData.email],
 *       'updating user'
 *     );
 *
 *     return updated;
 *   }
 * }
 * ```
 *
 * @example Using database transaction wrapper:
 * ```typescript
 * async transferUserToNewTeam(userId: string, newTeamId: string): Promise<void> {
 *   await this.executeTransaction(async (client) => {
 *     // Remove from old team
 *     await client.query('DELETE FROM user_team_assignments WHERE user_id = $1', [userId]);
 *
 *     // Add to new team
 *     await client.query(
 *       'INSERT INTO user_team_assignments (user_id, team_id, role) VALUES ($1, $2, $3)',
 *       [userId, newTeamId, 'member']
 *     );
 *
 *     // Update user record
 *     await client.query('UPDATE users SET team_id = $1 WHERE id = $2', [newTeamId, userId]);
 *   }, 'transferring user to new team');
 * }
 * ```
 *
 * The enhanced BaseService provides:
 * - Automatic database error mapping to ApplicationError instances
 * - Comprehensive validation helpers with contextual error messages
 * - Transaction support with automatic rollback on errors
 * - Resource existence and access control helpers
 * - Consistent error logging with service context
 * - Integration with the existing ApplicationError class and ErrorCode enum
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

  // ==========================================
  // Error Handling Methods
  // ==========================================

  /**
   * Creates a resource not found error with context
   * @param resource - The resource type (e.g., 'User', 'Team', 'Subscription')
   * @param id - The resource identifier
   * @param suggestion - Optional suggestion for resolution
   * @returns ApplicationError instance
   */
  protected createNotFoundError(
    resource: string,
    id?: string,
    suggestion?: string,
  ): ApplicationError {
    this.fastify.log.debug({ resource, id }, `${this.constructor.name}: Resource not found`);
    return ApplicationError.notFound(resource, id, suggestion);
  }

  /**
   * Creates an already exists error with context
   * @param resource - The resource type
   * @param field - The field that has the conflict
   * @param value - The conflicting value
   * @param suggestion - Optional suggestion for resolution
   * @returns ApplicationError instance
   */
  protected createAlreadyExistsError(
    resource: string,
    field?: string,
    value?: any,
    suggestion?: string,
  ): ApplicationError {
    this.fastify.log.debug(
      { resource, field, value },
      `${this.constructor.name}: Resource already exists`,
    );
    return ApplicationError.alreadyExists(resource, field, value, suggestion);
  }

  /**
   * Creates a validation error with context
   * @param message - The validation error message
   * @param field - The field that failed validation
   * @param value - The invalid value
   * @param suggestion - Optional suggestion for resolution
   * @param constraint - The constraint that was violated
   * @returns ApplicationError instance
   */
  protected createValidationError(
    message: string,
    field?: string,
    value?: any,
    suggestion?: string,
    constraint?: string,
  ): ApplicationError {
    this.fastify.log.debug(
      { field, value, constraint },
      `${this.constructor.name}: Validation error - ${message}`,
    );
    return ApplicationError.validation(message, field, value, suggestion, constraint);
  }

  /**
   * Creates a multiple validation errors instance
   * @param message - The overall validation error message
   * @param validationErrors - Array of specific validation errors
   * @param suggestion - Optional suggestion for resolution
   * @returns ApplicationError instance
   */
  protected createMultipleValidationErrors(
    message: string,
    validationErrors: Array<{
      field: string;
      message: string;
      code: string;
    }>,
    suggestion?: string,
  ): ApplicationError {
    this.fastify.log.debug(
      { validationErrors },
      `${this.constructor.name}: Multiple validation errors`,
    );
    return ApplicationError.validationMultiple(message, validationErrors, suggestion);
  }

  /**
   * Creates an unauthorized error
   * @param message - Optional custom message
   * @param suggestion - Optional suggestion for resolution
   * @returns ApplicationError instance
   */
  protected createUnauthorizedError(message?: string, suggestion?: string): ApplicationError {
    this.fastify.log.debug(`${this.constructor.name}: Unauthorized access attempt`);
    return ApplicationError.unauthorized(message, suggestion);
  }

  /**
   * Creates a forbidden error with required permission context
   * @param message - Optional custom message
   * @param requiredPermission - The permission required
   * @param suggestion - Optional suggestion for resolution
   * @returns ApplicationError instance
   */
  protected createForbiddenError(
    message?: string,
    requiredPermission?: string,
    suggestion?: string,
  ): ApplicationError {
    this.fastify.log.debug(
      { requiredPermission },
      `${this.constructor.name}: Forbidden access attempt`,
    );
    return ApplicationError.forbidden(message, requiredPermission, suggestion);
  }

  /**
   * Maps database errors to ApplicationError instances
   * @param error - The database error
   * @param context - Additional context about the operation
   * @returns ApplicationError instance
   */
  protected mapDatabaseError(error: any, context?: string): ApplicationError {
    const logContext = {
      error: error.message,
      code: error.code,
      constraint: error.constraint_name || error.constraint,
      table: error.table_name || error.table,
      column: error.column_name || error.column,
      detail: error.detail,
    };

    this.fastify.log.error(
      logContext,
      `${this.constructor.name}: Database error${context ? ` in ${context}` : ''}`,
    );

    // Handle specific PostgreSQL error codes
    if (error.code) {
      switch (error.code) {
        case '23505': // Unique violation
          return this.handleUniqueViolation(error);

        case '23503': // Foreign key violation
          return this.handleForeignKeyViolation(error);

        case '23502': // Not null violation
          return this.handleNotNullViolation(error);

        case '23514': // Check constraint violation
          return this.handleCheckConstraintViolation(error);

        case '42P01': // Table does not exist
          return ApplicationError.database(
            'Database table does not exist',
            error.constraint,
            error.table,
            error.column,
          );

        case '42703': // Column does not exist
          return ApplicationError.database(
            'Database column does not exist',
            error.constraint,
            error.table,
            error.column,
          );

        case '08003': // Connection does not exist
        case '08006': // Connection failure
        case '08001': // Unable to connect to server
          return ApplicationError.serviceUnavailable('database', 30);

        case '57014': // Query canceled
        case '57P01': // Admin shutdown
          return ApplicationError.timeout(context || 'database operation', 30000, true);

        default:
          return ApplicationError.database(
            error.message || 'Database operation failed',
            error.constraint,
            error.table,
            error.column,
          );
      }
    }

    // Handle generic database errors
    return ApplicationError.database(
      error.message || 'Database operation failed',
      error.constraint,
      error.table,
      error.column,
    );
  }

  /**
   * Handles PostgreSQL unique constraint violations
   * @param error - The database error
   * @returns ApplicationError instance
   */
  private handleUniqueViolation(error: any): ApplicationError {
    const constraint = error.constraint_name || error.constraint;
    let resource = 'Resource';
    let field = 'field';
    let suggestion = 'Use a different value or update the existing resource';

    // Map common constraint patterns
    if (constraint) {
      if (constraint.includes('email')) {
        resource = 'User';
        field = 'email';
        suggestion = 'Use a different email address or log in with the existing account';
      } else if (constraint.includes('username')) {
        resource = 'User';
        field = 'username';
        suggestion = 'Choose a different username';
      } else if (constraint.includes('name')) {
        resource = this.inferResourceFromConstraint(constraint);
        field = 'name';
        suggestion = `Choose a different ${field} for this ${resource.toLowerCase()}`;
      } else if (constraint.includes('api_key')) {
        resource = 'API Key';
        field = 'key';
        suggestion = 'API key already exists. Please generate a new one';
      }
    }

    return ApplicationError.alreadyExists(resource, field, undefined, suggestion);
  }

  /**
   * Handles PostgreSQL foreign key constraint violations
   * @param error - The database error
   * @returns ApplicationError instance
   */
  private handleForeignKeyViolation(error: any): ApplicationError {
    const constraint = error.constraint_name || error.constraint;
    let suggestion = 'Ensure all referenced resources exist';

    if (constraint) {
      if (constraint.includes('user')) {
        suggestion = 'Ensure the user exists before performing this operation';
      } else if (constraint.includes('team')) {
        suggestion = 'Ensure the team exists before performing this operation';
      } else if (constraint.includes('model')) {
        suggestion = 'Ensure the model exists and is available';
      }
    }

    return ApplicationError.notFound('Referenced resource', undefined, suggestion);
  }

  /**
   * Handles PostgreSQL not null constraint violations
   * @param error - The database error
   * @returns ApplicationError instance
   */
  private handleNotNullViolation(error: any): ApplicationError {
    const column = error.column_name || error.column || 'required field';
    const message = `Missing required field: ${column}`;
    const suggestion = `Please provide a value for ${column}`;

    return ApplicationError.validation(message, column, undefined, suggestion, 'not_null');
  }

  /**
   * Handles PostgreSQL check constraint violations
   * @param error - The database error
   * @returns ApplicationError instance
   */
  private handleCheckConstraintViolation(error: any): ApplicationError {
    const constraint = error.constraint_name || error.constraint;
    let message = 'Value violates database constraint';
    let suggestion = 'Please provide a valid value';

    if (constraint) {
      if (constraint.includes('email')) {
        message = 'Invalid email format';
        suggestion = 'Please provide a valid email address';
      } else if (constraint.includes('budget')) {
        message = 'Invalid budget amount';
        suggestion = 'Budget must be a positive number within allowed limits';
      } else if (constraint.includes('limit')) {
        message = 'Value exceeds allowed limits';
        suggestion = 'Please provide a value within the allowed range';
      }
    }

    return ApplicationError.validation(message, undefined, undefined, suggestion, constraint);
  }

  /**
   * Infers resource type from constraint name
   * @param constraint - The constraint name
   * @returns Inferred resource name
   */
  private inferResourceFromConstraint(constraint: string): string {
    if (constraint.includes('team')) return 'Team';
    if (constraint.includes('user')) return 'User';
    if (constraint.includes('subscription')) return 'Subscription';
    if (constraint.includes('api_key')) return 'API Key';
    if (constraint.includes('model')) return 'Model';
    return 'Resource';
  }

  // ==========================================
  // Validation Helper Methods
  // ==========================================

  /**
   * Validates required fields and throws validation error if missing
   * @param data - Object containing the data to validate
   * @param requiredFields - Array of required field names
   * @throws ApplicationError if validation fails
   */
  protected validateRequiredFields(data: any, requiredFields: string[]): void {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const message = `Missing required fields: ${missingFields.join(', ')}`;
      const validationErrors = missingFields.map((field) => ({
        field,
        message: `${field} is required`,
        code: 'REQUIRED',
      }));

      throw this.createMultipleValidationErrors(message, validationErrors);
    }
  }

  /**
   * Validates UUID format and throws error if invalid
   * @param value - The UUID value to validate
   * @param fieldName - The field name for error context
   * @throws ApplicationError if validation fails
   */
  protected validateUUID(value: string, fieldName: string = 'id'): void {
    if (!ValidationUtils.isValidUUID(value)) {
      throw this.createValidationError(
        `Invalid ${fieldName} format`,
        fieldName,
        value,
        `${fieldName} must be a valid UUID`,
      );
    }
  }

  /**
   * Validates email format and throws error if invalid
   * @param email - The email to validate
   * @param fieldName - The field name for error context
   * @throws ApplicationError if validation fails
   */
  protected validateEmail(email: string, fieldName: string = 'email'): void {
    if (!ValidationUtils.isValidEmail(email)) {
      throw this.createValidationError(
        `Invalid ${fieldName} format`,
        fieldName,
        email,
        'Please provide a valid email address',
      );
    }
  }

  /**
   * Validates model ID format and throws error if invalid
   * @param modelId - The model ID to validate
   * @param fieldName - The field name for error context
   * @throws ApplicationError if validation fails
   */
  protected validateModelId(modelId: string, fieldName: string = 'modelId'): void {
    if (!ValidationUtils.isValidModelId(modelId)) {
      throw this.createValidationError(
        `Invalid ${fieldName} format`,
        fieldName,
        modelId,
        'Model ID must contain only alphanumeric characters, hyphens, dots, and underscores',
      );
    }
  }

  /**
   * Validates array of model IDs and throws error if invalid
   * @param modelIds - The array of model IDs to validate
   * @param fieldName - The field name for error context
   * @throws ApplicationError if validation fails
   */
  protected validateModelIdArray(modelIds: string[], fieldName: string = 'modelIds'): void {
    if (!ValidationUtils.isValidModelIdArray(modelIds)) {
      throw this.createValidationError(
        `Invalid ${fieldName} format`,
        fieldName,
        modelIds,
        'All model IDs must be valid and the array cannot be empty',
      );
    }
  }

  // ==========================================
  // Database Operation Wrappers
  // ==========================================

  /**
   * Executes a database query with error handling
   * @param query - The SQL query
   * @param params - Query parameters
   * @param context - Context for error logging
   * @returns Query result
   * @throws ApplicationError if query fails
   */
  protected async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    context?: string,
  ): Promise<T> {
    try {
      if (!this.fastify.pg) {
        throw ApplicationError.serviceUnavailable('database');
      }

      const result = await this.fastify.pg.query(query, params);
      return result as T;
    } catch (error) {
      throw this.mapDatabaseError(error, context);
    }
  }

  /**
   * Executes a database query expecting a single row result
   * @param query - The SQL query
   * @param params - Query parameters
   * @param context - Context for error logging
   * @returns Single row result
   * @throws ApplicationError if query fails
   */
  protected async executeQueryOne<T = any>(
    query: string,
    params: any[] = [],
    context?: string,
  ): Promise<T> {
    try {
      if (!this.fastify.dbUtils) {
        throw ApplicationError.serviceUnavailable('database');
      }

      const result = await this.fastify.dbUtils.queryOne(query, params);
      return result as T;
    } catch (error) {
      throw this.mapDatabaseError(error, context);
    }
  }

  /**
   * Executes a database transaction with error handling
   * @param operations - Function containing database operations
   * @param context - Context for error logging
   * @returns Transaction result
   * @throws ApplicationError if transaction fails
   */
  protected async executeTransaction<T>(
    operations: (client: any) => Promise<T>,
    context?: string,
  ): Promise<T> {
    if (!this.fastify.pg) {
      throw ApplicationError.serviceUnavailable('database');
    }

    const client = await this.fastify.pg.connect();
    try {
      await client.query('BEGIN');
      const result = await operations(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw this.mapDatabaseError(error, context);
    } finally {
      client.release();
    }
  }

  // ==========================================
  // Resource Access Control Helper Methods
  // ==========================================

  /**
   * Checks if a resource exists and throws not found error if it doesn't
   * @param resource - The resource data
   * @param resourceType - The type of resource for error context
   * @param id - The resource identifier
   * @throws ApplicationError if resource not found
   */
  protected ensureResourceExists<T>(
    resource: T | null | undefined,
    resourceType: string,
    id?: string,
  ): asserts resource is T {
    if (!resource) {
      throw this.createNotFoundError(resourceType, id);
    }
  }

  /**
   * Checks if user has access to a resource and throws forbidden error if not
   * @param hasAccess - Boolean indicating if user has access
   * @param resourceType - The type of resource
   * @param requiredPermission - The required permission
   * @throws ApplicationError if access denied
   */
  protected ensureResourceAccess(
    hasAccess: boolean,
    resourceType: string = 'resource',
    requiredPermission?: string,
  ): void {
    if (!hasAccess) {
      const message = `Access denied to ${resourceType}`;
      const suggestion = requiredPermission
        ? `You need ${requiredPermission} permission to access this ${resourceType}`
        : undefined;
      throw this.createForbiddenError(message, requiredPermission, suggestion);
    }
  }
}
