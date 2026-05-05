export interface SupportChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  safetyNotice?: string;
}

export interface AssistantChatRequest {
  message: string;
  conversation_id?: string;
}

export interface AssistantChatResponse {
  message: string;
  conversation_id: string | null;
  blocked: boolean;
}

export interface AssistantHealthResponse {
  status: string;
  agent?: string;
  guardrails?: string;
}

export type AssistantSSEEvent =
  | { type: 'chunk'; data: { chunk: string; index: number } }
  | { type: 'retract_chunk'; data: { retract_chunk: number; placeholder: string } }
  | { type: 'error'; data: { error: string; retryable: boolean } }
  | { type: 'done'; data: { done: true; conversation_id: string; safety_notice?: string } };
