/**
 * Chat service for direct communication with LiteLLM endpoint
 * Handles message sending, cost calculation, and conversation export
 */

import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamChunk,
  ChatMessage,
  TokenUsage,
  ResponseMetrics,
  ConversationExport,
  ExportFormat,
  ChatError,
  DEFAULT_MODEL_PRICING,
  ModelPricing,
  CHAT_CONSTANTS,
} from '../types/chat';

export class ChatService {
  private pricing: ModelPricing = DEFAULT_MODEL_PRICING;

  /**
   * Send a message to the LiteLLM endpoint
   */
  async sendMessage(
    litellmUrl: string,
    apiKey: string,
    request: ChatCompletionRequest,
  ): Promise<{ response: ChatCompletionResponse; metrics: ResponseMetrics }> {
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateRequest(request);

      const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(CHAT_CONSTANTS.RESPONSE_TIMEOUT),
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      const data: ChatCompletionResponse = await response.json();

      // Add response time to the data
      data.responseTime = responseTime;

      // Calculate metrics
      const metrics: ResponseMetrics = {
        tokens: data.usage,
        responseTime,
        estimatedCost: this.calculateCost(request.model, data.usage),
        rawResponse: data,
      };

      return { response: data, metrics };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      if (error instanceof Error) {
        throw this.createChatError(error, responseTime);
      }
      throw error;
    }
  }

  /**
   * Send a streaming message to the LiteLLM endpoint
   */
  async sendStreamingMessage(
    litellmUrl: string,
    apiKey: string,
    request: ChatCompletionRequest,
    onChunk: (content: string, isComplete: boolean, timeToFirstToken?: number) => void,
    onComplete: (metrics: ResponseMetrics) => void,
    abortController?: AbortController,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateRequest(request);

      const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: abortController?.signal || AbortSignal.timeout(CHAT_CONSTANTS.RESPONSE_TIMEOUT),
      });

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let finalUsage: TokenUsage | null = null;
      let timeToFirstToken: number | undefined = undefined;
      let firstChunkReceived = false;

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                // Stream complete
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                const metrics: ResponseMetrics = {
                  tokens: finalUsage || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                  },
                  responseTime,
                  estimatedCost: finalUsage ? this.calculateCost(request.model, finalUsage) : 0,
                  timeToFirstToken,
                };

                onComplete(metrics);
                return;
              }

              try {
                const chunk: ChatCompletionStreamChunk = JSON.parse(data);
                const deltaContent = chunk.choices[0]?.delta?.content || '';

                if (deltaContent) {
                  // Capture time to first token on first content chunk
                  if (!firstChunkReceived) {
                    timeToFirstToken = performance.now() - startTime;
                    firstChunkReceived = true;
                  }

                  fullContent += deltaContent;
                  onChunk(fullContent, false, timeToFirstToken);
                }

                // Save usage data from final chunk
                if (chunk.usage) {
                  finalUsage = chunk.usage;
                }

                // Handle completion
                if (chunk.choices[0]?.finish_reason) {
                  onChunk(fullContent, true, timeToFirstToken);
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming chunk:', parseError);
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      if (error instanceof Error) {
        throw this.createChatError(error, responseTime);
      }
      throw error;
    }
  }

  /**
   * Calculate estimated cost based on token usage
   */
  calculateCost(model: string, usage: TokenUsage): number {
    const modelPricing = this.pricing[model];

    if (!modelPricing) {
      // Return 0 for unknown models
      return 0;
    }

    const promptCost = (usage.prompt_tokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completion_tokens / 1000) * modelPricing.completion;

    return promptCost + completionCost;
  }

  /**
   * Update model pricing information
   */
  updatePricing(newPricing: Partial<ModelPricing>): void {
    // Filter out undefined values
    const filteredPricing: ModelPricing = {};
    for (const [key, value] of Object.entries(newPricing)) {
      if (value !== undefined) {
        filteredPricing[key] = value;
      }
    }
    this.pricing = { ...this.pricing, ...filteredPricing };
  }

  /**
   * Export conversation in specified format
   */
  exportConversation(conversation: ConversationExport, format: ExportFormat): string {
    switch (format) {
      case 'json':
        return this.exportAsJSON(conversation);
      case 'markdown':
        return this.exportAsMarkdown(conversation);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Create a downloadable blob for conversation export
   */
  createExportBlob(content: string, format: ExportFormat): Blob {
    const mimeType = format === 'json' ? 'application/json' : 'text/markdown';
    return new Blob([content], { type: mimeType });
  }

  /**
   * Generate filename for export
   */
  generateExportFilename(title: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 50);
    return `${sanitizedTitle}-${timestamp}.${format}`;
  }

  /**
   * Create a chat message object
   */
  createMessage(role: 'user' | 'assistant' | 'system', content: string, id?: string): ChatMessage {
    return {
      id: id || this.generateMessageId(),
      role,
      content,
      timestamp: new Date(),
    };
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate chat completion request
   */
  private validateRequest(request: ChatCompletionRequest): void {
    if (!request.model) {
      throw new Error('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      throw new Error('At least one message is required');
    }

    if (
      request.temperature !== undefined &&
      (request.temperature < CHAT_CONSTANTS.TEMPERATURE_MIN ||
        request.temperature > CHAT_CONSTANTS.TEMPERATURE_MAX)
    ) {
      throw new Error(
        `Temperature must be between ${CHAT_CONSTANTS.TEMPERATURE_MIN} and ${CHAT_CONSTANTS.TEMPERATURE_MAX}`,
      );
    }

    if (
      request.max_tokens !== undefined &&
      (request.max_tokens < 1 || request.max_tokens > CHAT_CONSTANTS.MAX_TOKENS_LIMIT)
    ) {
      throw new Error(`Max tokens must be between 1 and ${CHAT_CONSTANTS.MAX_TOKENS_LIMIT}`);
    }
  }

  /**
   * Handle API errors and create appropriate error objects
   */
  private async handleApiError(response: Response): Promise<ChatError> {
    let errorData: any = {};

    try {
      errorData = await response.json();
    } catch {
      // Response body is not JSON
    }

    const error: ChatError = {
      type: this.getErrorType(response.status),
      message: this.getErrorMessage(response.status, errorData),
      details: errorData,
      retryable: this.isRetryable(response.status),
    };

    return error;
  }

  /**
   * Create chat error from generic error
   */
  private createChatError(error: Error, _responseTime: number): ChatError {
    if (error.name === 'AbortError') {
      return {
        type: 'aborted' as ChatError['type'],
        message: 'Response generation was stopped by user.',
        retryable: false,
      };
    }

    if (error.name === 'TimeoutError') {
      return {
        type: 'network_error',
        message: 'Request timed out. Please try again.',
        retryable: true,
      };
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: 'network_error',
        message: 'Network error. Please check your connection and try again.',
        retryable: true,
      };
    }

    return {
      type: 'api_error',
      message: error.message,
      retryable: false,
    };
  }

  /**
   * Determine error type based on HTTP status
   */
  private getErrorType(status: number): ChatError['type'] {
    if (status === 401 || status === 403) return 'auth_error';
    if (status === 429) return 'rate_limit';
    if (status >= 400 && status < 500) return 'validation_error';
    return 'api_error';
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(status: number, errorData: any): string {
    const message = errorData?.error?.message || errorData?.message;

    switch (status) {
      case 401:
        return 'Invalid API key. Please check your API key and try again.';
      case 403:
        return 'Access forbidden. Your API key may not have permission for this model.';
      case 429:
        return message || 'Rate limit exceeded. Please wait and try again.';
      case 400:
        return message || 'Invalid request. Please check your input.';
      case 422:
        return message || 'Validation error. Please check your parameters.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return message || `Request failed with status ${status}`;
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  /**
   * Export conversation as JSON
   */
  private exportAsJSON(conversation: ConversationExport): string {
    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Export conversation as Markdown
   */
  private exportAsMarkdown(conversation: ConversationExport): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${conversation.title}`);
    lines.push('');
    lines.push(`**Model:** ${conversation.model}`);
    lines.push(`**API Key:** ${conversation.apiKeyName}`);
    lines.push(`**Exported:** ${conversation.exportedAt.toISOString()}`);
    lines.push('');

    // Settings
    lines.push('## Configuration');
    lines.push('');
    lines.push(`- **Temperature:** ${conversation.settings.temperature}`);
    lines.push(`- **Max Tokens:** ${conversation.settings.maxTokens}`);
    if (conversation.settings.systemPrompt) {
      lines.push(`- **System Prompt:** ${conversation.settings.systemPrompt}`);
    }
    lines.push('');

    // Metrics
    lines.push('## Metrics');
    lines.push('');
    lines.push(`- **Total Messages:** ${conversation.metrics.messageCount}`);
    lines.push(`- **Total Tokens:** ${conversation.metrics.totalTokens}`);
    lines.push(`- **Total Cost:** $${conversation.metrics.totalCost.toFixed(4)}`);
    lines.push(
      `- **Average Response Time:** ${conversation.metrics.averageResponseTime.toFixed(0)}ms`,
    );
    lines.push('');

    // Messages
    lines.push('## Conversation');
    lines.push('');

    conversation.messages.forEach((message, index) => {
      const timestamp = message.timestamp.toLocaleString();
      const roleLabel =
        message.role === 'user'
          ? '🧑 **User**'
          : message.role === 'assistant'
            ? '🤖 **Assistant**'
            : '⚙️ **System**';

      lines.push(`### Message ${index + 1} - ${roleLabel} _(${timestamp})_`);
      lines.push('');
      lines.push(message.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }
}

// Export singleton instance
export const chatService = new ChatService();
