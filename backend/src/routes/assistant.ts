import { FastifyInstance } from 'fastify';
import { Type, Static } from '@sinclair/typebox';

const ChatRequestSchema = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 4000 }),
  conversation_id: Type.Optional(Type.String()),
});

type ChatRequest = Static<typeof ChatRequestSchema>;

const PROXY_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5_000;

export default async function assistantRoutes(fastify: FastifyInstance) {
  const agentUrl = fastify.config.SUPPORT_AGENT_URL!;

  fastify.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Assistant'],
        summary: 'Check support agent health',
        description: 'Proxies to the support agent health endpoint. No authentication required.',
        response: {
          200: Type.Object({
            status: Type.String(),
            agent: Type.Optional(Type.String()),
            guardrails: Type.Optional(Type.String()),
          }),
          503: Type.Object({
            status: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(`${agentUrl}/v1/health`, {
          signal: controller.signal,
        });
        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch {
        return reply.status(503).send({ status: 'unhealthy' });
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  fastify.post<{ Body: ChatRequest }>(
    '/chat',
    {
      preHandler: fastify.authenticateWithDevBypass,
      schema: {
        tags: ['Assistant'],
        summary: 'Send a chat message to the support agent',
        body: ChatRequestSchema,
        response: {
          200: Type.Object({
            message: Type.String(),
            conversation_id: Type.Union([Type.String(), Type.Null()]),
            blocked: Type.Boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

      try {
        const response = await fetch(`${agentUrl}/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: request.headers.authorization || '',
          },
          body: JSON.stringify(request.body),
          signal: controller.signal,
        });

        const data = await response.json();
        return reply.status(response.status).send(data);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return reply.status(504).send({ error: 'Agent request timed out' });
        }
        fastify.log.error(error, 'Failed to proxy chat request to agent');
        return reply.status(502).send({ error: 'Agent unavailable' });
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  fastify.post<{ Body: ChatRequest }>(
    '/chat/stream',
    {
      preHandler: fastify.authenticateWithDevBypass,
      schema: {
        tags: ['Assistant'],
        summary: 'Stream a chat response from the support agent via SSE',
        body: ChatRequestSchema,
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

      request.raw.on('close', () => {
        controller.abort();
        clearTimeout(timeout);
      });

      try {
        const response = await fetch(`${agentUrl}/v1/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: request.headers.authorization || '',
          },
          body: JSON.stringify(request.body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          return reply.status(response.status).send(data);
        }

        if (!response.ok) {
          const text = await response.text();
          fastify.log.error({ status: response.status, body: text }, 'Agent stream error');
          return reply.status(response.status).send({ error: 'Agent returned an error' });
        }

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        if (!response.body) {
          reply.raw.end();
          return;
        }

        const reader = response.body.getReader();

        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            fastify.log.error(error, 'Error reading agent stream');
          }
        } finally {
          reply.raw.end();
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          if (!reply.raw.headersSent) {
            return reply.status(504).send({ error: 'Agent request timed out' });
          }
        } else {
          fastify.log.error(error, 'Failed to proxy streaming request to agent');
          if (!reply.raw.headersSent) {
            return reply.status(502).send({ error: 'Agent unavailable' });
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    },
  );
}
