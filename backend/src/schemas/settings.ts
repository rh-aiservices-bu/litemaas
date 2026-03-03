import { Type, Static } from '@sinclair/typebox';

// Note: Type.Null() must come FIRST in unions with numeric types to prevent
// Fastify/Ajv coerceTypes from converting null → 0 for integers/numbers.
export const ApiKeyQuotaDefaultsSchema = Type.Object({
  defaults: Type.Object({
    maxBudget: Type.Optional(Type.Union([Type.Null(), Type.Number({ minimum: 0 })])),
    tpmLimit: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 0 })])),
    rpmLimit: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 0 })])),
    budgetDuration: Type.Optional(Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$' }),
      Type.Null(),
    ])),
    softBudget: Type.Optional(Type.Union([Type.Null(), Type.Number({ minimum: 0 })])),
  }),
  maximums: Type.Object({
    maxBudget: Type.Optional(Type.Union([Type.Null(), Type.Number({ minimum: 0 })])),
    tpmLimit: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 0 })])),
    rpmLimit: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 0 })])),
  }),
});

export type ApiKeyQuotaDefaultsInput = Static<typeof ApiKeyQuotaDefaultsSchema>;
