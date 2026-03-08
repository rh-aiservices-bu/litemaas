/**
 * Max int32 — sent to LiteLLM as sentinel for "unlimited" since it ignores null on update.
 * Used for tpm_limit and rpm_limit on both users and API keys.
 */
export const LITELLM_UNLIMITED = 2147483647;

export interface LiteLLMConfig {
  apiUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export const litellmConfig: LiteLLMConfig = {
  apiUrl: process.env.LITELLM_API_URL || 'http://localhost:4000',
  apiKey: process.env.LITELLM_API_KEY,
  timeout: parseInt(process.env.LITELLM_TIMEOUT || '30000'),
  retries: parseInt(process.env.LITELLM_RETRIES || '3'),
  retryDelay: parseInt(process.env.LITELLM_RETRY_DELAY || '1000'),
};
