import { Type } from '@sinclair/typebox';
import { TimestampSchema } from './common';

export const HealthStatusEnum = Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]);

export const HealthCheckSchema = Type.Object({
  status: HealthStatusEnum,
  timestamp: TimestampSchema,
  checks: Type.Object({
    database: HealthStatusEnum,
    redis: HealthStatusEnum,
    litellm: HealthStatusEnum,
  }),
});

export const ReadinessSchema = Type.Object({
  ready: Type.Boolean(),
});

export const LivenessSchema = Type.Object({
  alive: Type.Boolean(),
});
