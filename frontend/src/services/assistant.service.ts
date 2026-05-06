import { apiClient } from './api';
import type {
  AssistantChatRequest,
  AssistantHealthResponse,
  AssistantSSEEvent,
} from '../types/supportChat';

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onRetract: (index: number, placeholder: string) => void;
  onError: (error: string, retryable: boolean) => void;
  onDone: (conversationId: string, safetyNotice?: string) => void;
}

class AssistantService {
  async checkHealth(): Promise<AssistantHealthResponse> {
    return apiClient.get<AssistantHealthResponse>('/assistant/health');
  }

  async sendStreamingMessage(
    request: AssistantChatRequest,
    callbacks: StreamCallbacks,
    abortController?: AbortController,
  ): Promise<void> {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const response = await fetch('/api/v1/assistant/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: abortController?.signal,
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data.blocked) {
        callbacks.onChunk(data.message || '');
        callbacks.onDone(data.conversation_id || '', undefined);
      } else if (data.error) {
        callbacks.onError(data.error, false);
      } else {
        callbacks.onChunk(data.message || '');
        callbacks.onDone(data.conversation_id || '', undefined);
      }
      return;
    }

    if (!response.ok) {
      callbacks.onError(`Request failed with status ${response.status}`, response.status >= 500);
      return;
    }

    if (!response.body) {
      callbacks.onError('Response body is not readable', false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              const resolvedType = currentEventType || this.inferEventType(data);
              const event = this.parseSSEEvent(resolvedType, data);
              if (event) {
                this.handleSSEEvent(event, callbacks);
              }
            } catch {
              // Skip unparseable chunks
            }

            currentEventType = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private inferEventType(data: Record<string, unknown>): string {
    if ('chunk' in data) return 'chunk';
    if ('retract_chunk' in data) return 'retract_chunk';
    if ('done' in data) return 'done';
    if ('error' in data) return 'error';
    return '';
  }

  private parseSSEEvent(
    eventType: string,
    data: Record<string, unknown>,
  ): AssistantSSEEvent | null {
    switch (eventType) {
      case 'chunk':
        return {
          type: 'chunk',
          data: { chunk: data.chunk as string, index: data.index as number },
        };
      case 'retract_chunk':
        return {
          type: 'retract_chunk',
          data: {
            retract_chunk: data.retract_chunk as number,
            placeholder: data.placeholder as string,
          },
        };
      case 'error':
        return {
          type: 'error',
          data: { error: data.error as string, retryable: data.retryable as boolean },
        };
      case 'done':
        return {
          type: 'done',
          data: {
            done: true,
            conversation_id: data.conversation_id as string,
            safety_notice: data.safety_notice as string | undefined,
          },
        };
      default:
        return null;
    }
  }

  private handleSSEEvent(event: AssistantSSEEvent, callbacks: StreamCallbacks): void {
    switch (event.type) {
      case 'chunk':
        callbacks.onChunk(event.data.chunk);
        break;
      case 'retract_chunk':
        callbacks.onRetract(event.data.retract_chunk, event.data.placeholder);
        break;
      case 'error':
        callbacks.onError(event.data.error, event.data.retryable);
        break;
      case 'done':
        callbacks.onDone(event.data.conversation_id, event.data.safety_notice);
        break;
    }
  }
}

export const assistantService = new AssistantService();
