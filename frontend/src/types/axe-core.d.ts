// Type declarations for axe-core to work around module import issues

declare module 'axe-core' {
  export interface AxeResults {
    violations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      tags?: string[];
      nodes: Array<{
        target: string[];
        html: string;
        impact: string;
      }>;
    }>;
    incomplete: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl?: string;
      tags?: string[];
      nodes: Array<{
        target: string[];
        html: string;
        impact: string;
      }>;
    }>;
    passes: any[];
    inapplicable: any[];
    // Additional metadata fields present in axe-core results
    timestamp?: string;
    url?: string;
    toolOptions?: Record<string, unknown>;
    testEngine?: { name: string; version: string };
    testRunner?: { name: string };
    testEnvironment?: { userAgent?: string; windowWidth?: number; windowHeight?: number };
  }

  export interface RunOptions {
    runOnly?: { type: 'rule' | 'tag'; values: string[] } | string[];
    rules?: Record<string, { enabled?: boolean; [key: string]: unknown }>;
    tags?: string[];
    reporter?: 'v1' | 'v2' | 'v2.1' | string;
    resultTypes?: Array<'violations' | 'passes' | 'incomplete' | 'inapplicable'> | string[];
    [key: string]: unknown;
  }

  export function run(context?: any, options?: RunOptions): Promise<AxeResults>;
}

declare module '@axe-core/react' {
  export default function configure(
    reactDOMInstance: any,
    React: any,
    timeout: number,
    config?: any,
  ): void;
}

// Override the problematic @axe-core/react type definitions
declare module '@axe-core/react/dist/index' {
  export default function configure(
    reactDOMInstance: any,
    React: any,
    timeout: number,
    config?: any,
  ): void;
}
