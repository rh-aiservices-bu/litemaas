export interface CurrencySettings {
  code: string;
  symbol: string;
  name: string;
}

export const DEFAULT_CURRENCY: CurrencySettings = {
  code: 'USD',
  symbol: '$',
  name: 'US Dollar',
};
