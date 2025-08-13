import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Simplified test wrapper for isolated component testing
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="test-wrapper">{children}</div>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): ReturnType<typeof render> => render(ui, { wrapper: TestWrapper, ...options });

export * from '@testing-library/react';
export { customRender as render };
