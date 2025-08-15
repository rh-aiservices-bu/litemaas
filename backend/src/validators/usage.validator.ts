import { Type, Static } from '@sinclair/typebox';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../types';

// Date range validation schema
export const DateRangeSchema = Type.Object({
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
});

// Usage metrics query schema
export const UsageMetricsQuerySchema = Type.Composite([
  DateRangeSchema,
  Type.Object({
    modelId: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
    apiKeyId: Type.Optional(Type.String({ format: 'uuid' })),
  }),
]);

// Usage summary query schema
export const UsageSummaryQuerySchema = Type.Composite([
  Type.Object({
    startDate: Type.String({ format: 'date' }),
    endDate: Type.String({ format: 'date' }),
  }),
  Type.Object({
    modelId: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
    subscriptionId: Type.Optional(Type.String({ format: 'uuid' })),
    granularity: Type.Optional(
      Type.Union([
        Type.Literal('hour'),
        Type.Literal('day'),
        Type.Literal('week'),
        Type.Literal('month'),
      ]),
    ),
  }),
]);

// Usage time series query schema
export const UsageTimeSeriesQuerySchema = Type.Composite([
  Type.Object({
    startDate: Type.String({ format: 'date' }),
    endDate: Type.String({ format: 'date' }),
  }),
  Type.Object({
    interval: Type.Optional(
      Type.Union([
        Type.Literal('hour'),
        Type.Literal('day'),
        Type.Literal('week'),
        Type.Literal('month'),
      ]),
    ),
    modelId: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
    subscriptionId: Type.Optional(Type.String({ format: 'uuid' })),
  }),
]);

// Usage export query schema
export const UsageExportQuerySchema = Type.Composite([
  Type.Object({
    startDate: Type.Optional(Type.String({ format: 'date' })),
    endDate: Type.Optional(Type.String({ format: 'date' })),
  }),
  Type.Object({
    format: Type.Optional(Type.Union([Type.Literal('csv'), Type.Literal('json')])),
    modelId: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
    subscriptionId: Type.Optional(Type.String({ format: 'uuid' })),
    apiKeyId: Type.Optional(Type.String({ format: 'uuid' })),
  }),
]);

// Type definitions
export type DateRangeQuery = Static<typeof DateRangeSchema>;
export type UsageMetricsQuery = Static<typeof UsageMetricsQuerySchema>;
export type UsageSummaryQuery = Static<typeof UsageSummaryQuerySchema>;
export type UsageTimeSeriesQuery = Static<typeof UsageTimeSeriesQuerySchema>;
export type UsageExportQuery = Static<typeof UsageExportQuerySchema>;

// Validation constants
const MAX_DATE_RANGE_DAYS = 90;
const MIN_DATE = new Date('2024-01-01');

/**
 * Validates date range ensuring it's within limits and doesn't contain future dates
 */
export function validateDateRange(
  startDate?: string,
  endDate?: string,
): {
  isValid: boolean;
  error?: string;
  parsedStartDate?: Date;
  parsedEndDate?: Date;
} {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  // If no dates provided, use last 30 days
  if (!startDate && !endDate) {
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    return {
      isValid: true,
      parsedStartDate: defaultStartDate,
      parsedEndDate: defaultEndDate,
    };
  }

  // Parse dates
  let parsedStartDate: Date | undefined;
  let parsedEndDate: Date | undefined;

  if (startDate) {
    parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      return { isValid: false, error: 'Invalid start date format' };
    }
  }

  if (endDate) {
    parsedEndDate = new Date(endDate);
    if (isNaN(parsedEndDate.getTime())) {
      return { isValid: false, error: 'Invalid end date format' };
    }
  }

  // If only one date is provided, create a reasonable range
  if (parsedStartDate && !parsedEndDate) {
    parsedEndDate = new Date(parsedStartDate);
    parsedEndDate.setDate(parsedEndDate.getDate() + 7); // 7 days forward
    if (parsedEndDate > now) {
      parsedEndDate = new Date(now);
    }
  } else if (!parsedStartDate && parsedEndDate) {
    parsedStartDate = new Date(parsedEndDate);
    parsedStartDate.setDate(parsedStartDate.getDate() - 7); // 7 days backward
  }

  // Ensure we have both dates at this point
  if (!parsedStartDate || !parsedEndDate) {
    return { isValid: false, error: 'Both start and end dates are required' };
  }

  // Check if dates are not in the future
  if (parsedStartDate > now) {
    return { isValid: false, error: 'Start date cannot be in the future' };
  }

  if (parsedEndDate > now) {
    return { isValid: false, error: 'End date cannot be in the future' };
  }

  // Check if start date is before end date
  if (parsedStartDate > parsedEndDate) {
    return { isValid: false, error: 'Start date must be before end date' };
  }

  // Check if dates are not too old
  if (parsedStartDate < MIN_DATE) {
    return {
      isValid: false,
      error: `Start date cannot be before ${MIN_DATE.toISOString().split('T')[0]}`,
    };
  }

  // Check if date range is not too large
  const daysDifference = Math.ceil(
    (parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDifference > MAX_DATE_RANGE_DAYS) {
    return {
      isValid: false,
      error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
    };
  }

  return {
    isValid: true,
    parsedStartDate,
    parsedEndDate,
  };
}

/**
 * Sanitizes API key parameter by removing special characters and ensuring UUID format
 */
export function sanitizeApiKeyId(apiKeyId?: string): string | undefined {
  if (!apiKeyId) return undefined;

  // Remove any special characters and ensure it's a valid UUID format
  const sanitized = apiKeyId.replace(/[^a-f0-9-]/gi, '').toLowerCase();

  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!uuidRegex.test(sanitized)) {
    return undefined;
  }

  return sanitized;
}

/**
 * Verifies that the API key belongs to the authenticated user
 */
export async function verifyApiKeyOwnership(
  fastify: any,
  userId: string,
  apiKeyId: string,
): Promise<boolean> {
  try {
    const result = await fastify.dbUtils.queryOne(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [apiKeyId, userId],
    );

    return !!result;
  } catch (error) {
    fastify.log.error(error, 'Failed to verify API key ownership');
    return false;
  }
}

/**
 * Middleware for validating usage metrics query parameters
 */
export async function validateUsageMetricsQuery(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const query = request.query as any;
  const user = (request as AuthenticatedRequest).user;

  // Validate date range
  const dateValidation = validateDateRange(query.startDate, query.endDate);
  if (!dateValidation.isValid) {
    throw request.server.createError(400, dateValidation.error!);
  }

  // Sanitize API key parameter
  if (query.apiKeyId) {
    const sanitizedApiKeyId = sanitizeApiKeyId(query.apiKeyId);
    if (!sanitizedApiKeyId) {
      throw request.server.createError(400, 'Invalid API key ID format');
    }

    // Verify API key ownership
    const isOwner = await verifyApiKeyOwnership(request.server, user.userId, sanitizedApiKeyId);
    if (!isOwner) {
      throw request.server.createError(403, 'API key not found or access denied');
    }

    // Update query with sanitized value
    query.apiKeyId = sanitizedApiKeyId;
  }

  // Sanitize model ID parameter
  if (query.modelId) {
    query.modelId = query.modelId.trim();
    if (query.modelId.length === 0 || query.modelId.length > 255) {
      throw request.server.createError(400, 'Invalid model ID');
    }
  }

  // Set validated dates in query
  query.startDate = dateValidation.parsedStartDate?.toISOString().split('T')[0];
  query.endDate = dateValidation.parsedEndDate?.toISOString().split('T')[0];
}

/**
 * Middleware for validating usage summary query parameters
 */
export async function validateUsageSummaryQuery(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const query = request.query as any;

  // Validate required date range
  if (!query.startDate || !query.endDate) {
    throw request.server.createError(400, 'Start date and end date are required');
  }

  const dateValidation = validateDateRange(query.startDate, query.endDate);
  if (!dateValidation.isValid) {
    throw request.server.createError(400, dateValidation.error!);
  }

  // Validate granularity
  if (query.granularity) {
    const validGranularities = ['hour', 'day', 'week', 'month'];
    if (!validGranularities.includes(query.granularity)) {
      throw request.server.createError(400, 'Invalid granularity value');
    }
  }

  // Sanitize model ID and subscription ID
  if (query.modelId) {
    query.modelId = query.modelId.trim();
    if (query.modelId.length === 0 || query.modelId.length > 255) {
      throw request.server.createError(400, 'Invalid model ID');
    }
  }

  if (query.subscriptionId) {
    const sanitizedSubscriptionId = sanitizeApiKeyId(query.subscriptionId);
    if (!sanitizedSubscriptionId) {
      throw request.server.createError(400, 'Invalid subscription ID format');
    }
    query.subscriptionId = sanitizedSubscriptionId;
  }

  // Set validated dates in query
  query.startDate = dateValidation.parsedStartDate?.toISOString().split('T')[0];
  query.endDate = dateValidation.parsedEndDate?.toISOString().split('T')[0];
}

/**
 * Middleware for validating usage export query parameters
 */
export async function validateUsageExportQuery(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const query = request.query as any;
  const user = (request as AuthenticatedRequest).user;

  // Validate date range (optional for export)
  const dateValidation = validateDateRange(query.startDate, query.endDate);
  if (!dateValidation.isValid) {
    throw request.server.createError(400, dateValidation.error!);
  }

  // Validate format
  if (query.format && !['csv', 'json'].includes(query.format)) {
    throw request.server.createError(400, 'Invalid export format. Must be csv or json');
  }

  // Sanitize and validate API key parameter
  if (query.apiKeyId) {
    const sanitizedApiKeyId = sanitizeApiKeyId(query.apiKeyId);
    if (!sanitizedApiKeyId) {
      throw request.server.createError(400, 'Invalid API key ID format');
    }

    // Verify API key ownership
    const isOwner = await verifyApiKeyOwnership(request.server, user.userId, sanitizedApiKeyId);
    if (!isOwner) {
      throw request.server.createError(403, 'API key not found or access denied');
    }

    query.apiKeyId = sanitizedApiKeyId;
  }

  // Sanitize other parameters
  if (query.modelId) {
    query.modelId = query.modelId.trim();
    if (query.modelId.length === 0 || query.modelId.length > 255) {
      throw request.server.createError(400, 'Invalid model ID');
    }
  }

  if (query.subscriptionId) {
    const sanitizedSubscriptionId = sanitizeApiKeyId(query.subscriptionId);
    if (!sanitizedSubscriptionId) {
      throw request.server.createError(400, 'Invalid subscription ID format');
    }
    query.subscriptionId = sanitizedSubscriptionId;
  }

  // Set validated dates in query
  query.startDate = dateValidation.parsedStartDate?.toISOString().split('T')[0];
  query.endDate = dateValidation.parsedEndDate?.toISOString().split('T')[0];
}
