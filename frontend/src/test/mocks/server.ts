import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Enhanced MSW server setup with better AbortSignal and async operation support
export const server = setupServer(...handlers);
