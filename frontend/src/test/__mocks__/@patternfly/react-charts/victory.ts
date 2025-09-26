/**
 * Mock for @patternfly/react-charts/victory subpath
 * This re-exports Victory components and utilities used by PatternFly charts
 */
import React from 'react';

// Re-export all Victory components from the main victory mock
export * from '../../victory';

// Mock createContainer for interactive tooltips (used in UsageTrends, ModelUsageTrends)
export const createContainer = (...types: string[]) => {
  return ({ children, ...props }: any) =>
    React.createElement('div', {
      'data-testid': `victory-container-${types.join('-')}`,
      'data-container-types': types.join(','),
      'data-props': JSON.stringify(props),
      children,
    });
};

// Mock getCustomTheme for custom chart themes (used in ModelDistributionChart, ModelUsageTrends)
export const getCustomTheme = (colorTheme: any, variantTheme?: any) => ({
  colorTheme,
  variantTheme: variantTheme || {},
  name: 'custom-theme',
});

// Re-export Victory theme
export const VictoryTheme = {
  material: { name: 'material' },
  grayscale: { name: 'grayscale' },
};

// Export default for default imports
export default {
  createContainer,
  getCustomTheme,
  VictoryTheme,
};
