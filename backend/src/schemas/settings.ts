import { Type, Static } from '@sinclair/typebox';

export const ApiKeyQuotaDefaultsSchema = Type.Object({
  defaults: Type.Object({
    maxBudget: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
    tpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    rpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    budgetDuration: Type.Optional(Type.Union([
      Type.Literal('daily'),
      Type.Literal('weekly'),
      Type.Literal('monthly'),
      Type.Literal('yearly'),
      Type.String({ pattern: '^\\d+[smhd]$|^\\d+mo$' }),
      Type.Null(),
    ])),
    softBudget: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
  }),
  maximums: Type.Object({
    maxBudget: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
    tpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    rpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  }),
});

export type ApiKeyQuotaDefaultsInput = Static<typeof ApiKeyQuotaDefaultsSchema>;
