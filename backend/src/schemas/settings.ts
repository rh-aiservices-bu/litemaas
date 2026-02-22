import { Type, Static } from '@sinclair/typebox';

export const ApiKeyQuotaDefaultsSchema = Type.Object({
  defaults: Type.Object({
    maxBudget: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
    tpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    rpmLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    budgetDuration: Type.Optional(Type.Union([
      Type.String({
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
      }),
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
