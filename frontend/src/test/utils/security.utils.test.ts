import { describe, it, expect } from 'vitest';
import {
  maskApiKey,
  sanitizeChartLabel,
  validateChartData,
  sanitizeNumericValue,
  sanitizeModelName,
  validateDateRange,
  formatCurrency,
  isValidChartDataPoint,
  sanitizeChartDataArray,
} from '../../utils/security.utils';

describe('Security Utils', () => {
  describe('maskApiKey', () => {
    describe('Valid inputs', () => {
      it('masks standard API key correctly', () => {
        const apiKey = 'sk-1234567890abcdef1234567890abcdef';
        const result = maskApiKey(apiKey);
        expect(result).toBe('sk-****cdef');
      });

      it('masks API key without sk- prefix', () => {
        const apiKey = '1234567890abcdef1234567890abcdef';
        const result = maskApiKey(apiKey);
        expect(result).toBe('****cdef');
      });

      it('masks long API key correctly', () => {
        const apiKey = 'sk-' + 'a'.repeat(100);
        const result = maskApiKey(apiKey);
        expect(result).toBe('sk-****aaaa');
      });
    });

    describe('Edge cases and security inputs', () => {
      it('handles null input', () => {
        const result = maskApiKey(null as any);
        expect(result).toBe('Invalid Key');
      });

      it('handles undefined input', () => {
        const result = maskApiKey(undefined as any);
        expect(result).toBe('Invalid Key');
      });

      it('handles empty string', () => {
        const result = maskApiKey('');
        expect(result).toBe('Invalid Key');
      });

      it('handles non-string input', () => {
        const result = maskApiKey(12345 as any);
        expect(result).toBe('Invalid Key');
      });

      it('handles object input', () => {
        const result = maskApiKey({ key: 'value' } as any);
        expect(result).toBe('Invalid Key');
      });

      it('handles array input', () => {
        const result = maskApiKey(['key1', 'key2'] as any);
        expect(result).toBe('Invalid Key');
      });

      it('masks short API key (less than 8 characters)', () => {
        const result = maskApiKey('short');
        expect(result).toBe('****');
      });

      it('handles extremely short API key', () => {
        const result = maskApiKey('a');
        expect(result).toBe('****');
      });
    });

    describe('Malicious inputs', () => {
      it('handles XSS attempt in API key', () => {
        const maliciousKey = 'sk-<script>alert("xss")</script>1234';
        const result = maskApiKey(maliciousKey);
        expect(result).toBe('sk-****1234');
        expect(result).not.toContain('<script>');
      });

      it('handles SQL injection attempt', () => {
        const maliciousKey = "sk-'; DROP TABLE users; --1234";
        const result = maskApiKey(maliciousKey);
        expect(result).toBe('sk-****1234');
      });

      it('handles Unicode attacks', () => {
        const maliciousKey = 'sk-\u0000\u0001\u0002\u0003abcd1234';
        const result = maskApiKey(maliciousKey);
        expect(result).toBe('sk-****1234');
      });
    });
  });

  describe('sanitizeChartLabel', () => {
    describe('Valid inputs', () => {
      it('returns clean text unchanged', () => {
        const result = sanitizeChartLabel('Clean Text 123');
        expect(result).toBe('Clean Text 123');
      });

      it('handles alphanumeric with spaces', () => {
        const result = sanitizeChartLabel('Model GPT 4 Turbo');
        expect(result).toBe('Model GPT 4 Turbo');
      });
    });

    describe('XSS protection', () => {
      it('removes HTML script tags', () => {
        const malicious = '<script>alert("xss")</script>Safe Text';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('Safe Text');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('</script>');
      });

      it('removes complex HTML tags', () => {
        const malicious = '<div onclick="malicious()">Content</div>';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('Content');
        expect(result).not.toContain('<div>');
        expect(result).not.toContain('onclick');
      });

      it('escapes dangerous characters', () => {
        const dangerous = 'Text with <>&"\'';
        const result = sanitizeChartLabel(dangerous);
        expect(result).toBe('Text with &lt;&gt;&amp;&quot;&#x27;');
      });

      it('handles nested HTML tags', () => {
        const malicious = '<div><script>alert(1)</script><p>text</p></div>';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('text');
      });

      it('removes self-closing HTML tags', () => {
        const malicious = 'Before<img src="x" onerror="alert(1)"/>After';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('BeforeAfter');
      });
    });

    describe('Edge cases', () => {
      it('handles null input', () => {
        const result = sanitizeChartLabel(null as any);
        expect(result).toBe('');
      });

      it('handles undefined input', () => {
        const result = sanitizeChartLabel(undefined as any);
        expect(result).toBe('');
      });

      it('handles empty string', () => {
        const result = sanitizeChartLabel('');
        expect(result).toBe('');
      });

      it('handles non-string input', () => {
        const result = sanitizeChartLabel(12345 as any);
        expect(result).toBe('');
      });

      it('trims whitespace', () => {
        const result = sanitizeChartLabel('  Text with spaces  ');
        expect(result).toBe('Text with spaces');
      });

      it('limits length to 100 characters', () => {
        const longText = 'a'.repeat(200);
        const result = sanitizeChartLabel(longText);
        expect(result.length).toBe(100);
      });
    });

    describe('Advanced malicious inputs', () => {
      it('handles JavaScript protocol injection', () => {
        const malicious = 'javascript:alert("xss")';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('javascript:alert(&quot;xss&quot;)');
      });

      it('handles data URL attacks', () => {
        const malicious = 'data:text/html,<script>alert(1)</script>';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('data:text/html,');
      });

      it('handles Unicode normalization attacks', () => {
        const malicious = 'Iлｄѕ﹤script﹥alert(1)﹤/script﹥';
        const result = sanitizeChartLabel(malicious);
        expect(result).not.toContain('<script>');
      });

      it('handles mixed content attacks', () => {
        const malicious = 'Normal<script>/* comment */alert(1)</script>Text';
        const result = sanitizeChartLabel(malicious);
        expect(result).toBe('NormalText');
      });
    });
  });

  describe('validateChartData', () => {
    const validData = [
      { name: 'GPT-4', value: 100, category: 'AI' },
      { name: 'Claude', value: 85, category: 'AI' },
    ];

    describe('Valid data validation', () => {
      it('validates correct data structure', () => {
        const result = validateChartData(validData, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitizedData).toHaveLength(2);
      });

      it('sanitizes string fields in valid data', () => {
        const dataWithHTML = [{ name: '<b>GPT-4</b>', value: 100 }];
        const result = validateChartData(dataWithHTML, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData[0].name).toBe('GPT-4');
      });

      it('validates numeric fields correctly', () => {
        const result = validateChartData(validData, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData[0].value).toBe(100);
        expect(result.sanitizedData[1].value).toBe(85);
      });
    });

    describe('Data validation errors', () => {
      it('rejects non-array input', () => {
        const result = validateChartData('not an array' as any, ['name']);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Data must be an array');
        expect(result.sanitizedData).toHaveLength(0);
      });

      it('identifies missing required fields', () => {
        const incompleteData: Record<string, any>[] = [{ name: 'GPT-4' }];
        const result = validateChartData(incompleteData, ['name', 'value']);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('missing required fields: value');
      });

      it('rejects invalid objects in array', () => {
        const invalidData = [null, { name: 'GPT-4', value: 100 }] as any[];
        const result = validateChartData(invalidData as any, ['name', 'value']);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Item at index 0 is not a valid object');
        expect(result.sanitizedData).toHaveLength(1); // Only valid item
      });

      it('handles invalid numeric values', () => {
        const invalidData = [
          { name: 'Model', value: Infinity },
          { name: 'Model2', value: -1 },
        ];
        const result = validateChartData(invalidData, ['name', 'value']);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('invalid numeric value');
        expect(result.sanitizedData[0].value).toBe(0); // Defaults invalid to 0
        expect(result.sanitizedData[1].value).toBe(0); // Negative defaults to 0
      });
    });

    describe('Security validation', () => {
      it('sanitizes malicious string content', () => {
        const maliciousData = [{ name: '<script>alert("xss")</script>Model', value: 100 }];
        const result = validateChartData(maliciousData, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData[0].name).toBe('Model');
        expect(result.sanitizedData[0].name).not.toContain('<script>');
      });

      it('handles SQL injection attempts in strings', () => {
        const maliciousData = [{ name: "'; DROP TABLE charts; --", value: 100 }];
        const result = validateChartData(maliciousData, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData[0].name).toBe('&#x27;; DROP TABLE charts; --');
      });

      it('validates against prototype pollution', () => {
        const maliciousData = [{ name: 'Model', value: 100, __proto__: { polluted: true } }];
        const result = validateChartData(maliciousData, ['name', 'value']);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData[0]).not.toHaveProperty('polluted');
      });
    });
  });

  describe('sanitizeNumericValue', () => {
    describe('Valid numeric inputs', () => {
      it('returns valid positive numbers unchanged', () => {
        expect(sanitizeNumericValue(42)).toBe(42);
        expect(sanitizeNumericValue(3.14159)).toBe(3.14159);
        expect(sanitizeNumericValue(0)).toBe(0);
      });

      it('applies min/max constraints', () => {
        expect(sanitizeNumericValue(5, { min: 10, max: 100 })).toBe(10);
        expect(sanitizeNumericValue(150, { min: 10, max: 100 })).toBe(100);
        expect(sanitizeNumericValue(50, { min: 10, max: 100 })).toBe(50);
      });

      it('handles negative numbers when allowed', () => {
        expect(sanitizeNumericValue(-5, { allowNegative: true })).toBe(-5);
        expect(sanitizeNumericValue(-10, { allowNegative: true, min: -20 })).toBe(-10);
      });
    });

    describe('Invalid and malicious inputs', () => {
      it('rejects infinite values', () => {
        expect(sanitizeNumericValue(Infinity)).toBe(0);
        expect(sanitizeNumericValue(-Infinity)).toBe(0);
        expect(sanitizeNumericValue(Infinity, { defaultValue: 100 })).toBe(100);
      });

      it('rejects NaN values', () => {
        expect(sanitizeNumericValue(NaN)).toBe(0);
        expect(sanitizeNumericValue(NaN, { defaultValue: 42 })).toBe(42);
      });

      it('converts string numbers safely', () => {
        expect(sanitizeNumericValue('42')).toBe(42);
        expect(sanitizeNumericValue('3.14')).toBe(3.14);
        expect(sanitizeNumericValue('invalid')).toBe(0);
      });

      it('rejects malicious string inputs', () => {
        expect(sanitizeNumericValue('javascript:alert(1)')).toBe(0);
        expect(sanitizeNumericValue('<script>alert(1)</script>')).toBe(0);
        expect(sanitizeNumericValue('eval("malicious")')).toBe(0);
      });

      it('rejects negative numbers by default', () => {
        expect(sanitizeNumericValue(-5)).toBe(0);
        expect(sanitizeNumericValue(-100)).toBe(0);
      });

      it('handles object inputs safely', () => {
        expect(sanitizeNumericValue({})).toBe(0);
        expect(sanitizeNumericValue({ valueOf: () => 42 })).toBe(42);
        expect(sanitizeNumericValue({ valueOf: () => Infinity })).toBe(0);
      });

      it('handles array inputs safely', () => {
        expect(sanitizeNumericValue([])).toBe(0);
        expect(sanitizeNumericValue([42])).toBe(42);
        expect(sanitizeNumericValue([1, 2, 3])).toBe(0); // Invalid conversion
      });
    });

    describe('Edge cases', () => {
      it('handles null and undefined', () => {
        expect(sanitizeNumericValue(null)).toBe(0);
        expect(sanitizeNumericValue(undefined)).toBe(0);
      });

      it('handles very large numbers', () => {
        const largeNumber = Number.MAX_SAFE_INTEGER + 1;
        expect(sanitizeNumericValue(largeNumber, { max: Number.MAX_SAFE_INTEGER })).toBe(
          Number.MAX_SAFE_INTEGER,
        );
      });

      it('handles very small numbers', () => {
        expect(sanitizeNumericValue(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
      });

      it('respects custom default values', () => {
        expect(sanitizeNumericValue('invalid', { defaultValue: 999 })).toBe(999);
        expect(sanitizeNumericValue(NaN, { defaultValue: -1, allowNegative: true })).toBe(-1);
      });
    });
  });

  describe('sanitizeModelName', () => {
    describe('Valid inputs', () => {
      it('preserves valid model names', () => {
        expect(sanitizeModelName('GPT-4')).toBe('GPT-4');
        expect(sanitizeModelName('Claude_3')).toBe('Claude_3');
        expect(sanitizeModelName('Model.v2')).toBe('Model.v2');
        expect(sanitizeModelName('Llama 2')).toBe('Llama 2');
      });

      it('preserves forward slashes for model paths', () => {
        expect(sanitizeModelName('openai/gpt-4')).toBe('openai/gpt-4');
        expect(sanitizeModelName('anthropic/claude-3')).toBe('anthropic/claude-3');
      });
    });

    describe('Malicious input sanitization', () => {
      it('removes dangerous characters', () => {
        expect(sanitizeModelName('Model<script>alert(1)</script>')).toBe('Modelscriptalert1script');
        expect(sanitizeModelName('Model"onclick="alert(1)"')).toBe('Modelonclickalert1');
        expect(sanitizeModelName("Model';DROP TABLE models;--")).toBe('ModelDROP TABLE models');
      });

      it('handles XSS attempts', () => {
        const malicious = 'javascript:alert("xss")';
        const result = sanitizeModelName(malicious);
        expect(result).toBe('javascriptalertxss');
        expect(result).not.toContain(':');
        expect(result).not.toContain('"');
      });

      it('removes Unicode control characters', () => {
        const malicious = 'Model\u0000\u0001\u0002Name';
        const result = sanitizeModelName(malicious);
        expect(result).toBe('ModelName');
      });

      it('handles mixed malicious content', () => {
        const malicious = 'GPT<img src=x onerror=alert(1)>4';
        const result = sanitizeModelName(malicious);
        expect(result).toBe('GPTimg srcx onerroralert14');
      });
    });

    describe('Edge cases', () => {
      it('handles null and undefined', () => {
        expect(sanitizeModelName(null as any)).toBe('Unknown Model');
        expect(sanitizeModelName(undefined as any)).toBe('Unknown Model');
      });

      it('handles empty string', () => {
        expect(sanitizeModelName('')).toBe('Unknown Model');
      });

      it('handles non-string input', () => {
        expect(sanitizeModelName(12345 as any)).toBe('Unknown Model');
        expect(sanitizeModelName({} as any)).toBe('Unknown Model');
      });

      it('trims and limits length', () => {
        const longName = 'a'.repeat(100);
        const result = sanitizeModelName(longName);
        expect(result.length).toBe(50);
      });

      it('handles whitespace-only input', () => {
        expect(sanitizeModelName('   ')).toBe('Unknown Model');
        expect(sanitizeModelName('\t\n\r')).toBe('Unknown Model');
      });
    });
  });

  describe('validateDateRange', () => {
    const validStart = '2024-01-01';
    const validEnd = '2024-01-31';

    describe('Valid date ranges', () => {
      it('validates correct date range', () => {
        const result = validateDateRange(validStart, validEnd);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedDates).toEqual({
          start: '2024-01-01',
          end: '2024-01-31',
        });
      });

      it('handles different date formats', () => {
        const result = validateDateRange('2024-06-15T10:30:00Z', '2024-06-20T15:45:00Z');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedDates?.start).toBe('2024-06-15');
        expect(result.sanitizedDates?.end).toBe('2024-06-20');
      });
    });

    describe('Invalid date inputs', () => {
      it('rejects missing dates', () => {
        expect(validateDateRange('', validEnd).isValid).toBe(false);
        expect(validateDateRange(validStart, '').isValid).toBe(false);
        expect(validateDateRange('', '').error).toBe('Both start and end dates are required');
      });

      it('rejects malformed dates', () => {
        const result = validateDateRange('invalid-date', validEnd);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid date format');
      });

      it('rejects dates in wrong order', () => {
        const result = validateDateRange('2024-12-31', '2024-01-01');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Start date must be before end date');
      });

      it('rejects date range exceeding 2 years', () => {
        const start = '2020-01-01';
        const end = '2023-01-01';
        const result = validateDateRange(start, end);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Date range cannot exceed 2 years');
      });

      it('rejects future dates', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 10);
        const result = validateDateRange(validStart, futureDate.toISOString().split('T')[0]);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('End date cannot be in the future');
      });
    });

    describe('Security validation', () => {
      it('handles malicious date strings', () => {
        const maliciousDate = '<script>alert("xss")</script>';
        const result = validateDateRange(maliciousDate, validEnd);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid date format');
      });

      it('handles SQL injection attempts', () => {
        const maliciousDate = "2024-01-01'; DROP TABLE dates; --";
        const result = validateDateRange(maliciousDate, validEnd);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid date format');
      });

      it('handles extremely long date strings', () => {
        const longDate = '2024-01-01' + 'a'.repeat(10000);
        const result = validateDateRange(longDate, validEnd);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid date format');
      });
    });
  });

  describe('formatCurrency', () => {
    describe('Valid currency formatting', () => {
      it('formats positive numbers correctly', () => {
        expect(formatCurrency(42.5)).toBe('$42.50');
        expect(formatCurrency(1000)).toBe('$1,000.00');
        expect(formatCurrency(0.01)).toBe('$0.01');
      });

      it('handles zero correctly', () => {
        expect(formatCurrency(0)).toBe('$0.00');
      });

      it('formats large numbers with commas', () => {
        expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
      });
    });

    describe('Invalid input handling', () => {
      it('handles negative numbers by converting to zero', () => {
        expect(formatCurrency(-100)).toBe('$0.00');
      });

      it('handles infinite values', () => {
        expect(formatCurrency(Infinity)).toBe('$0.00');
        expect(formatCurrency(-Infinity)).toBe('$0.00');
      });

      it('handles NaN values', () => {
        expect(formatCurrency(NaN)).toBe('$0.00');
      });

      it('handles non-numeric inputs', () => {
        expect(formatCurrency('invalid' as any)).toBe('$0.00');
        expect(formatCurrency({} as any)).toBe('$0.00');
        expect(formatCurrency(null as any)).toBe('$0.00');
      });
    });
  });

  describe('isValidChartDataPoint', () => {
    describe('Valid data points', () => {
      it('validates correct data structure', () => {
        expect(isValidChartDataPoint({ x: 'label', y: 100 })).toBe(true);
        expect(isValidChartDataPoint({ x: 1, y: 200 })).toBe(true);
        expect(isValidChartDataPoint({ x: 'test', y: 0 })).toBe(true);
      });

      it('allows additional properties', () => {
        expect(isValidChartDataPoint({ x: 'label', y: 100, extra: 'data' })).toBe(true);
      });
    });

    describe('Invalid data points', () => {
      it('rejects null and undefined', () => {
        expect(isValidChartDataPoint(null)).toBe(false);
        expect(isValidChartDataPoint(undefined)).toBe(false);
      });

      it('rejects missing required properties', () => {
        expect(isValidChartDataPoint({ x: 'label' })).toBe(false);
        expect(isValidChartDataPoint({ y: 100 })).toBe(false);
        expect(isValidChartDataPoint({})).toBe(false);
      });

      it('rejects invalid data types', () => {
        expect(isValidChartDataPoint({ x: null, y: 100 })).toBe(false);
        expect(isValidChartDataPoint({ x: 'label', y: 'invalid' })).toBe(false);
        expect(isValidChartDataPoint({ x: 'label', y: Infinity })).toBe(false);
        expect(isValidChartDataPoint({ x: 'label', y: NaN })).toBe(false);
      });

      it('rejects non-object inputs', () => {
        expect(isValidChartDataPoint('string')).toBe(false);
        expect(isValidChartDataPoint(42)).toBe(false);
        expect(isValidChartDataPoint([])).toBe(false);
      });
    });
  });

  describe('sanitizeChartDataArray', () => {
    describe('Valid data array processing', () => {
      it('processes valid data array', () => {
        const validData = [
          { x: 'A', y: 100 },
          { x: 'B', y: 200 },
        ];
        const result = sanitizeChartDataArray(validData);
        expect(result).toEqual(validData);
      });

      it('sanitizes string labels', () => {
        const dataWithHTML = [{ x: '<b>Label</b>', y: 100 }];
        const result = sanitizeChartDataArray(dataWithHTML);
        expect(result[0].x).toBe('Label');
        expect(result[0].y).toBe(100);
      });

      it('sanitizes numeric values', () => {
        const dataWithInvalid = [
          { x: 'A', y: -50 },
          { x: 'B', y: Infinity },
        ];
        const result = sanitizeChartDataArray(dataWithInvalid);
        expect(result[0].y).toBe(0); // Negative becomes 0
        expect(result[1].y).toBe(0); // Infinity becomes 0
      });
    });

    describe('Invalid input handling', () => {
      it('handles non-array input', () => {
        const result = sanitizeChartDataArray('not an array' as any);
        expect(result).toEqual([]);
      });

      it('filters out invalid data points', () => {
        const mixedData = [
          { x: 'A', y: 100 }, // Valid
          { x: 'B' }, // Invalid - missing y
          null, // Invalid
          { x: 'C', y: 'invalid' }, // Invalid - y not number
          { x: 'D', y: 200 }, // Valid
        ];
        const result = sanitizeChartDataArray(mixedData);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ x: 'A', y: 100 });
        expect(result[1]).toEqual({ x: 'D', y: 200 });
      });

      it('handles empty array', () => {
        const result = sanitizeChartDataArray([]);
        expect(result).toEqual([]);
      });
    });

    describe('Security processing', () => {
      it('sanitizes malicious labels in array', () => {
        const maliciousData = [
          { x: '<script>alert("xss")</script>', y: 100 },
          { x: 'javascript:alert(1)', y: 200 },
        ];
        const result = sanitizeChartDataArray(maliciousData);
        expect(result[0].x).toBe('');
        expect(result[1].x).toBe('javascript:alert(1)'); // Sanitized but kept
        expect(result).toHaveLength(2);
      });

      it('handles mixed valid and malicious data', () => {
        const mixedData = [
          { x: 'Safe Label', y: 100 },
          { x: '<img src=x onerror=alert(1)>', y: 200 },
          { x: 'Another Safe', y: 300 },
        ];
        const result = sanitizeChartDataArray(mixedData);
        expect(result[0].x).toBe('Safe Label');
        expect(result[1].x).toBe('');
        expect(result[2].x).toBe('Another Safe');
        expect(result).toHaveLength(3);
      });
    });
  });
});
