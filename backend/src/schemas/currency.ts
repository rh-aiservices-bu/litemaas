import { Type, Static } from '@sinclair/typebox';

export const CurrencySettingsSchema = Type.Object(
  {
    code: Type.String({
      minLength: 3,
      maxLength: 3,
      description: 'ISO 4217 currency code',
      examples: ['USD', 'EUR', 'GBP'],
    }),
    symbol: Type.String({
      minLength: 1,
      maxLength: 5,
      description: 'Currency symbol',
      examples: ['$', '€', '£'],
    }),
    name: Type.String({
      minLength: 1,
      maxLength: 50,
      description: 'Currency display name',
      examples: ['US Dollar', 'Euro', 'British Pound'],
    }),
  },
  {
    $id: 'CurrencySettings',
    title: 'Currency Settings',
    description: 'Currency configuration for monetary values display',
  },
);

export type CurrencySettingsInput = Static<typeof CurrencySettingsSchema>;

export const SupportedCurrencySchema = Type.Object({
  code: Type.String(),
  symbol: Type.String(),
  name: Type.String(),
});

export const SupportedCurrenciesResponseSchema = Type.Array(SupportedCurrencySchema);
