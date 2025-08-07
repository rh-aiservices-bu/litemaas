/**
 * Common validation utilities used across multiple services.
 * These utilities help ensure data consistency and validation logic is centralized.
 */
export class ValidationUtils {
  /**
   * Validates an email address format
   * @param email - The email address to validate
   * @returns true if valid, false otherwise
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates a UUID format
   * @param uuid - The UUID to validate
   * @returns true if valid UUID, false otherwise
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validates a model ID format
   * @param modelId - The model ID to validate
   * @returns true if valid, false otherwise
   */
  static isValidModelId(modelId: string): boolean {
    if (!modelId || typeof modelId !== 'string') {
      return false;
    }

    // Model ID should be non-empty, contain only alphanumeric, hyphens, dots, and underscores
    const modelIdRegex = /^[a-zA-Z0-9\-_.]+$/;
    return modelIdRegex.test(modelId) && modelId.length > 0 && modelId.length <= 100;
  }

  /**
   * Validates an array of model IDs
   * @param modelIds - Array of model IDs to validate
   * @returns true if all are valid, false otherwise
   */
  static isValidModelIdArray(modelIds: string[]): boolean {
    if (!Array.isArray(modelIds) || modelIds.length === 0) {
      return false;
    }

    return modelIds.every((id) => ValidationUtils.isValidModelId(id));
  }

  /**
   * Validates a budget amount
   * @param budget - The budget amount to validate
   * @returns true if valid, false otherwise
   */
  static isValidBudget(budget: number): boolean {
    return typeof budget === 'number' && budget >= 0 && budget <= 1000000 && !isNaN(budget);
  }

  /**
   * Validates TPM (Tokens Per Minute) limit
   * @param tpm - The TPM limit to validate
   * @returns true if valid, false otherwise
   */
  static isValidTPMLimit(tpm: number): boolean {
    return typeof tpm === 'number' && tpm >= 0 && tpm <= 1000000 && Number.isInteger(tpm);
  }

  /**
   * Validates RPM (Requests Per Minute) limit
   * @param rpm - The RPM limit to validate
   * @returns true if valid, false otherwise
   */
  static isValidRPMLimit(rpm: number): boolean {
    return typeof rpm === 'number' && rpm >= 0 && rpm <= 10000 && Number.isInteger(rpm);
  }

  /**
   * Validates a team name
   * @param name - The team name to validate
   * @returns true if valid, false otherwise
   */
  static isValidTeamName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // Team name should be 3-50 characters, alphanumeric with spaces, hyphens, and underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]{3,50}$/;
    return nameRegex.test(name.trim());
  }

  /**
   * Validates a username
   * @param username - The username to validate
   * @returns true if valid, false otherwise
   */
  static isValidUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }

    // Username should be 3-30 characters, alphanumeric with dots, hyphens, and underscores
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validates an API key name
   * @param name - The API key name to validate
   * @returns true if valid, false otherwise
   */
  static isValidApiKeyName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // API key name should be 1-100 characters, no special characters except spaces, hyphens, and underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]{1,100}$/;
    return nameRegex.test(name.trim());
  }

  /**
   * Validates a date is in the future
   * @param date - The date to validate
   * @returns true if date is in the future, false otherwise
   */
  static isDateInFuture(date: Date): boolean {
    return date instanceof Date && date.getTime() > Date.now();
  }

  /**
   * Validates a subscription status
   * @param status - The status to validate
   * @returns true if valid status, false otherwise
   */
  static isValidSubscriptionStatus(status: string): boolean {
    const validStatuses = ['pending', 'active', 'suspended', 'cancelled', 'expired'];
    return validStatuses.includes(status);
  }

  /**
   * Validates a user role
   * @param role - The role to validate
   * @returns true if valid role, false otherwise
   */
  static isValidUserRole(role: string): boolean {
    const validRoles = ['user', 'admin', 'moderator'];
    return validRoles.includes(role);
  }

  /**
   * Validates a team member role
   * @param role - The team member role to validate
   * @returns true if valid role, false otherwise
   */
  static isValidTeamMemberRole(role: string): boolean {
    const validRoles = ['member', 'admin', 'owner'];
    return validRoles.includes(role);
  }

  /**
   * Sanitizes a string for safe database storage
   * @param input - The input string to sanitize
   * @param maxLength - Maximum allowed length (default: 255)
   * @returns Sanitized string
   */
  static sanitizeString(input: string, maxLength: number = 255): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
      .substring(0, maxLength);
  }

  /**
   * Validates and sanitizes metadata object
   * @param metadata - The metadata object to validate
   * @returns Sanitized metadata object or null if invalid
   */
  static validateAndSanitizeMetadata(metadata: unknown): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const sanitized: Record<string, unknown> = {};
    const maxKeys = 20;
    let keyCount = 0;

    for (const [key, value] of Object.entries(metadata)) {
      if (keyCount >= maxKeys) {
        break;
      }

      // Validate key
      if (typeof key !== 'string' || key.length > 50) {
        continue;
      }

      // Sanitize and validate value
      if (typeof value === 'string') {
        sanitized[key] = ValidationUtils.sanitizeString(value, 500);
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
      // Skip other types (objects, arrays, functions, etc.)

      keyCount++;
    }

    return sanitized;
  }
}
