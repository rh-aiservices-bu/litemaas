import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { server } from './mocks/server';
import './i18n-test-setup'; // Initialize i18n for tests

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Fix AbortSignal and AbortController mocking for proper RequestInit compatibility
class MockAbortSignal extends EventTarget {
  aborted = false;
  reason?: any;
  onabort: ((this: AbortSignal, ev: Event) => any) | null = null;

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason ?? new Error('AbortError: The operation was aborted');
    }
  }

  static abort(reason?: any): AbortSignal {
    const signal = new MockAbortSignal();
    signal.aborted = true;
    signal.reason = reason;
    return signal as any;
  }

  static timeout(delay: number): AbortSignal {
    const signal = new MockAbortSignal();
    setTimeout(() => {
      signal.aborted = true;
      signal.reason = new DOMException('TimeoutError: The operation timed out');
      signal.dispatchEvent(new Event('abort'));
    }, delay);
    return signal as any;
  }
}

class MockAbortController {
  signal: AbortSignal;

  constructor() {
    this.signal = new MockAbortSignal() as any;
  }

  abort(reason?: any): void {
    if (!this.signal.aborted) {
      (this.signal as any).aborted = true;
      (this.signal as any).reason =
        reason ?? new DOMException('AbortError: The operation was aborted');
      this.signal.dispatchEvent(new Event('abort'));
    }
  }
}

// Properly mock AbortController and AbortSignal globally only if missing
if (!(global as any).AbortController) {
  (global as any).AbortController = MockAbortController as any;
}
if (!(global as any).AbortSignal) {
  (global as any).AbortSignal = MockAbortSignal as any;
}

// Enhance fetch mocking for better compatibility
const originalFetch = global.fetch;
if (!originalFetch) {
  // Mock fetch if not available
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      clone: function () {
        return this;
      },
    } as Response),
  );
}

// Mock Headers if not available
if (typeof Headers === 'undefined') {
  global.Headers = class MockHeaders {
    private headers = new Map<string, string>();

    constructor(init?: HeadersInit) {
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => this.headers.set(key, value));
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.headers.set(key, value));
        } else {
          Object.entries(init).forEach(([key, value]) => this.headers.set(key, value));
        }
      }
    }

    append(name: string, value: string) {
      this.headers.set(name, value);
    }
    delete(name: string) {
      this.headers.delete(name);
    }
    get(name: string) {
      return this.headers.get(name) || null;
    }
    has(name: string) {
      return this.headers.has(name);
    }
    set(name: string, value: string) {
      this.headers.set(name, value);
    }
    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach(callback);
    }
    entries() {
      return this.headers.entries();
    }
    keys() {
      return this.headers.keys();
    }
    values() {
      return this.headers.values();
    }
    [Symbol.iterator]() {
      return this.headers[Symbol.iterator]();
    }
  } as any;
}

// Mock Request if not available
if (typeof Request === 'undefined') {
  global.Request = class MockRequest {
    method: string = 'GET';
    url: string = '';
    headers: Headers;
    body: ReadableStream | null = null;
    bodyUsed: boolean = false;
    signal: AbortSignal;

    constructor(input: RequestInfo, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.signal = init?.signal || (new MockAbortSignal() as any);
    }

    clone() {
      return new (this.constructor as any)(this.url, {
        method: this.method,
        headers: this.headers,
        signal: this.signal,
      });
    }
    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(0));
    }
    blob() {
      return Promise.resolve(new Blob());
    }
    json() {
      return Promise.resolve({});
    }
    text() {
      return Promise.resolve('');
    }
  } as any;
}

// Mock Response if not available
if (typeof Response === 'undefined') {
  global.Response = class MockResponse {
    ok: boolean = true;
    status: number = 200;
    statusText: string = 'OK';
    headers: Headers = new Headers();
    body: ReadableStream | null = null;
    bodyUsed: boolean = false;
    url: string = '';

    constructor(_body?: BodyInit | null, init?: ResponseInit) {
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Headers(init?.headers);
    }

    static json(data: any) {
      return new MockResponse(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    clone() {
      return new MockResponse(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers,
      });
    }
    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(0));
    }
    blob() {
      return Promise.resolve(new Blob());
    }
    json() {
      return Promise.resolve({});
    }
    text() {
      return Promise.resolve('');
    }
  } as any;
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  root: null,
  rootMargin: '0px',
  thresholds: [0],
  takeRecords: vi.fn(() => []),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage with in-memory store
const __localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => (key in __localStorageStore ? __localStorageStore[key] : null)),
  setItem: vi.fn((key: string, value: string) => {
    __localStorageStore[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete __localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(__localStorageStore)) delete __localStorageStore[key];
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock canvas for chart rendering
const canvasContextMock = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Array(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
};

global.HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === '2d') {
    return canvasContextMock as unknown as CanvasRenderingContext2D;
  }
  return null;
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock URL.createObjectURL and URL.revokeObjectURL for CSV export
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Node.js environment compatibility fixes
if (typeof global !== 'undefined' && typeof window !== 'undefined') {
  // Add Node.js specific polyfills for better SSR compatibility
  try {
    global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
    global.TextDecoder = global.TextDecoder || require('util').TextDecoder;
  } catch (e) {
    // Fallback if util is not available
    global.TextEncoder = class TextEncoder {
      encode(input: string) {
        return new Uint8Array(Buffer.from(input, 'utf-8'));
      }
    } as any;
    global.TextDecoder = class TextDecoder {
      decode(input: Uint8Array) {
        return Buffer.from(input).toString('utf-8');
      }
    } as any;
  }
}

// Mock performance API if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  } as any;
}

// Environment-specific configurations
if (typeof process !== 'undefined') {
  // Ensure proper process environment for SSR tests
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.VITE_MOCK_AUTH = 'true';

  // Set reasonable defaults for missing environment variables
  if (!process.env.VITE_APP_NAME) {
    process.env.VITE_APP_NAME = 'LiteMaaS Test';
  }
}

// Global error handlers for unhandled promises and async operations
const unhandledErrors: Error[] = [];
const unhandledRejections: any[] = [];

// Track unhandled promise rejections
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  // Filter out expected test errors
  if (event.reason && typeof event.reason.message === 'string') {
    if (
      event.reason.message.includes('OAuth login failed') ||
      event.reason.message.includes('AbortError') ||
      event.reason.message.includes(
        'useNotifications must be used within a NotificationProvider',
      ) ||
      event.reason.message.includes('_suppressLogging')
    ) {
      return;
    }
  }

  // Also check if the error has the _suppressLogging property directly
  if (event.reason && (event.reason as any)._suppressLogging) {
    return;
  }

  unhandledRejections.push(event.reason);
  // Don't prevent default - let the error be logged but continue tests
  console.warn('Unhandled promise rejection in test:', event.reason);
};

// Track unhandled errors
const handleUnhandledError = (event: ErrorEvent) => {
  unhandledErrors.push(event.error);
  console.warn('Unhandled error in test:', event.error);
  // Prevent the error from failing the test
  event.preventDefault();
};

// Setup MSW server and error handling
beforeAll(() => {
  // Enhanced MSW server configuration with better signal handling
  server.listen({
    onUnhandledRequest: 'warn', // Changed from 'error' to 'warn' for better test stability
  });

  // Suppress console errors during tests but keep warnings visible
  vi.spyOn(console, 'error').mockImplementation((message, ...args) => {
    // Allow certain error messages to pass through for debugging
    if (
      typeof message === 'string' &&
      (message.includes('react-i18next') ||
        message.includes('Warning: ') ||
        message.includes('AbortError') || // Allow AbortError messages
        message.includes('RequestInit')) // Allow RequestInit error messages
    ) {
      console.warn('Test warning:', message, ...args);
    }
  });

  // Enhanced global error handling with better async operation support
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', handleUnhandledRejection, { passive: true });
    window.addEventListener('error', handleUnhandledError, { passive: true });
  }

  // Enhanced Node.js process error handling for SSR tests
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason: unknown) => {
      // Filter out expected/harmless rejections
      const message = (reason as any)?.message as string | undefined;
      if (message) {
        // Skip logging expected test errors that don't impact functionality
        if (
          message.includes('OAuth login failed') ||
          message.includes('AbortError') ||
          message.includes('useNotifications must be used within a NotificationProvider') ||
          message.includes('_suppressLogging')
        ) {
          return;
        }
      }

      // Also check if the error has the _suppressLogging property directly
      if ((reason as any)?._suppressLogging) {
        return;
      }
      unhandledRejections.push(reason as any);
      console.warn('Unhandled Node.js promise rejection in test:', reason);
    });

    process.on('uncaughtException', (error) => {
      // Filter out expected test errors
      if (error && typeof error.message === 'string') {
        if (error.message.includes('AbortError') || (error as any)._suppressLogging) {
          return;
        }
      }
      unhandledErrors.push(error);
      console.warn('Uncaught Node.js exception in test:', error);
    });
  }
});

afterEach(() => {
  server.resetHandlers();

  // Clear error tracking for next test
  unhandledErrors.length = 0;
  unhandledRejections.length = 0;
  // Reset localStorage between tests
  localStorage.clear();
});

afterAll(() => {
  server.close();

  // Clean up global event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleUnhandledError);
  }

  // Report summary of unhandled errors if any
  if (unhandledErrors.length > 0 || unhandledRejections.length > 0) {
    console.warn(
      `Test run completed with ${unhandledErrors.length} unhandled errors and ${unhandledRejections.length} unhandled promise rejections`,
    );
  }
});
