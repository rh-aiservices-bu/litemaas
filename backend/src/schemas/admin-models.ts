import { Type } from '@sinclair/typebox';
import { TimestampSchema } from './common.js';

// LiteLLM model creation/update payload schema
export const LiteLLMModelParamsSchema = Type.Object({
  model: Type.String(),
  api_base: Type.String(),
  custom_llm_provider: Type.Literal('openai'),
  input_cost_per_token: Type.Number({ minimum: 0 }),
  output_cost_per_token: Type.Number({ minimum: 0 }),
  tpm: Type.Integer({ minimum: 1 }),
  rpm: Type.Integer({ minimum: 1 }),
});

export const LiteLLMModelInfoSchema = Type.Object({
  db_model: Type.Literal(true),
  team_id: Type.String(),
  max_tokens: Type.Integer({ minimum: 1 }),
  supports_vision: Type.Boolean(),
  supports_function_calling: Type.Boolean(),
  supports_parallel_function_calling: Type.Boolean(),
  supports_tool_choice: Type.Boolean(),
});

export const CreateLiteLLMModelSchema = Type.Object({
  model_name: Type.String({ minLength: 1 }),
  litellm_params: LiteLLMModelParamsSchema,
  model_info: LiteLLMModelInfoSchema,
});

// Frontend form payload schema (what the frontend sends)
export const AdminCreateModelSchema = Type.Object({
  model_name: Type.String({ minLength: 1 }),
  backend_model_name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  api_base: Type.String({ format: 'uri' }),
  api_key: Type.Optional(Type.String()),
  input_cost_per_token: Type.Number({ minimum: 0 }),
  output_cost_per_token: Type.Number({ minimum: 0 }),
  tpm: Type.Integer({ minimum: 1 }),
  rpm: Type.Integer({ minimum: 1 }),
  max_tokens: Type.Integer({ minimum: 1 }),
  supports_vision: Type.Boolean(),
  supports_function_calling: Type.Boolean(),
  supports_parallel_function_calling: Type.Boolean(),
  supports_tool_choice: Type.Boolean(),
});

export const AdminUpdateModelSchema = Type.Partial(AdminCreateModelSchema);

// Response schemas
export const AdminModelCreateResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  model: Type.Optional(
    Type.Object({
      id: Type.String(),
      model_name: Type.String(),
      created_at: Type.Optional(TimestampSchema),
    }),
  ),
});

export const AdminModelUpdateResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  model: Type.Optional(
    Type.Object({
      id: Type.String(),
      model_name: Type.String(),
      updated_at: Type.Optional(TimestampSchema),
    }),
  ),
});

export const AdminModelDeleteResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

// Path parameters
export const AdminModelParamsSchema = Type.Object({
  id: Type.String(),
});

// Error response schema
export const AdminModelErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Integer(),
});
