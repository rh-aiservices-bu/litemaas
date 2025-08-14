/**
 * Chat-related TypeScript type definitions for the Test Chatbot feature
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  stream_options?: {
    include_usage: boolean;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  }>;
  usage: TokenUsage;
  responseTime?: number; // Added for timing measurement
}

export interface ChatCompletionStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  }>;
  usage?: TokenUsage; // Only present in the final chunk
}

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface ResponseMetrics {
  tokens: TokenUsage;
  responseTime: number;
  estimatedCost: number;
  rawResponse?: ChatCompletionResponse;
  timeToFirstToken?: number;
}

export interface SavedPrompt {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface BuiltInPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: 'code' | 'translation' | 'analysis' | 'format' | 'general';
}

export interface ChatbotConfiguration {
  selectedApiKeyId: string | null;
  selectedModel: string | null;
  settings: ChatSettings;
  enableStreaming?: boolean;
}

export interface StreamingState {
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingContent: string;
  abortController: AbortController | null;
}

export interface ConversationExport {
  title: string;
  model: string;
  apiKeyName: string;
  settings: ChatSettings;
  messages: ChatMessage[];
  metrics: {
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
    messageCount: number;
  };
  exportedAt: Date;
}

export type ExportFormat = 'json' | 'markdown';

export interface ChatError {
  type:
    | 'api_error'
    | 'network_error'
    | 'validation_error'
    | 'rate_limit'
    | 'auth_error'
    | 'aborted';
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ModelPricing {
  [modelName: string]: {
    prompt: number; // Price per 1K prompt tokens
    completion: number; // Price per 1K completion tokens
    currency: string;
  };
}

// Default pricing for common models (in USD per 1K tokens)
export const DEFAULT_MODEL_PRICING: ModelPricing = {
  'gpt-4': {
    prompt: 0.03,
    completion: 0.06,
    currency: 'USD',
  },
  'gpt-4-turbo': {
    prompt: 0.01,
    completion: 0.03,
    currency: 'USD',
  },
  'gpt-3.5-turbo': {
    prompt: 0.0005,
    completion: 0.0015,
    currency: 'USD',
  },
  'claude-3-opus': {
    prompt: 0.015,
    completion: 0.075,
    currency: 'USD',
  },
  'claude-3-sonnet': {
    prompt: 0.003,
    completion: 0.015,
    currency: 'USD',
  },
  'claude-3-haiku': {
    prompt: 0.00025,
    completion: 0.00125,
    currency: 'USD',
  },
};

// Constants for chat configuration
export const CHAT_CONSTANTS = {
  MAX_MESSAGES: 1000, // Maximum messages in conversation
  MAX_TOKENS_LIMIT: 128000, // Maximum tokens allowed
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 2,
  TEMPERATURE_DEFAULT: 0.7,
  MAX_TOKENS_DEFAULT: 1024,
  RESPONSE_TIMEOUT: 60000, // 60 seconds
  STORAGE_KEY: 'litemaas_saved_prompts',
  CONVERSATION_STORAGE_KEY: 'litemaas_current_conversation',
} as const;
