import { Type, TSchema } from '@sinclair/typebox';

// Common schemas for reuse across endpoints
export const PaginationSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export const PaginationResponseSchema = Type.Object({
  page: Type.Integer(),
  limit: Type.Integer(),
  total: Type.Integer(),
  totalPages: Type.Integer(),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    statusCode: Type.Integer(),
    details: Type.Optional(Type.Record(Type.String(), Type.Any())),
    requestId: Type.Optional(Type.String()),
    correlationId: Type.Optional(Type.String()),
    timestamp: Type.String(),
    retry: Type.Optional(Type.Any()),
  }),
});

export const SuccessMessageSchema = Type.Object({
  message: Type.String(),
});

export const IdParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const TimestampSchema = Type.String({ format: 'date-time' });

export const DateQuerySchema = Type.Object({
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
});

// Common response wrapper
export const createPaginatedResponse = <T extends TSchema>(itemSchema: T) =>
  Type.Object({
    data: Type.Array(itemSchema),
    pagination: PaginationResponseSchema,
  });

// Common API response wrapper
export const createApiResponse = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    success: Type.Boolean(),
    data: Type.Optional(dataSchema),
    error: Type.Optional(
      Type.Object({
        code: Type.String(),
        message: Type.String(),
        details: Type.Optional(Type.Record(Type.String(), Type.Any())),
      }),
    ),
  });
