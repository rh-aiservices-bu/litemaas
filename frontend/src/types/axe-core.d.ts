// Type declarations for axe-core to work around module import issues

declare module 'axe-core' {
  export interface AxeResults {
    violations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
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
      nodes: Array<{
        target: string[];
        html: string;
        impact: string;
      }>;
    }>;
    passes: any[];
    inapplicable: any[];
  }

  export interface RunOptions {
    runOnly?: string[];
    resultTypes?: string[];
  }

  export function run(
    context?: any,
    options?: RunOptions
  ): Promise<AxeResults>;
}

declare module '@axe-core/react' {
  export default function configure(
    reactDOMInstance: any,
    React: any,
    timeout: number,
    config?: any
  ): void;
}

// Override the problematic @axe-core/react type definitions
declare module '@axe-core/react/dist/index' {
  export default function configure(
    reactDOMInstance: any,
    React: any,
    timeout: number,
    config?: any
  ): void;
}