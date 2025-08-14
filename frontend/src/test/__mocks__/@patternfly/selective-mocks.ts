import { vi } from 'vitest';
import React from 'react';

/**
 * Selective PatternFly Component Mocks
 *
 * This module provides a selective mocking strategy for PatternFly components.
 * Only components that cause issues in the test environment are mocked,
 * while basic components are allowed to render naturally.
 *
 * Key principles:
 * - Mock only problematic components (charts, complex layouts)
 * - Allow basic inputs and buttons to render for better testing
 * - Preserve component props for assertion testing
 * - Provide meaningful mock implementations
 */

/**
 * List of components that should be fully mocked due to DOM/canvas issues
 */
export const COMPONENTS_TO_MOCK = [
  // Charts - require canvas context
  'Chart',
  'ChartArea',
  'ChartAxis',
  'ChartBar',
  'ChartBullet',
  'ChartDonut',
  'ChartGroup',
  'ChartLegend',
  'ChartLine',
  'ChartPie',
  'ChartScatter',
  'ChartStack',
  'ChartThreshold',
  'ChartVoronoiContainer',

  // Complex layouts that cause measurement issues
  'DataList',
  'DataListItem',
  'DataListCell',
  'DataListItemRow',
  'DataListItemCells',

  // Components with complex positioning
  'Popover',
  'Tooltip',
  'Dropdown',
  'Select',
  'DatePicker',
  'TimePicker',

  // Heavy components
  'Wizard',
  'CodeEditor',
  'FileUpload',

  // Components that rely on ResizeObserver
  'Truncate',
  'ExpandableSection',
];

/**
 * List of components that should render with simplified implementations
 */
export const COMPONENTS_TO_SIMPLIFY = [
  'Tabs',
  'Tab',
  'TabTitleText',
  'TabContent',
  'Accordion',
  'AccordionItem',
  'AccordionContent',
  'AccordionToggle',
];

/**
 * Components that should render normally for better testing
 */
export const COMPONENTS_TO_RENDER = [
  // Basic inputs
  'TextInput',
  'TextArea',
  'FormGroup',
  'Form',
  'Checkbox',
  'Radio',
  'Switch',

  // Basic buttons and actions
  'Button',
  'ActionList',
  'ActionListItem',

  // Basic layout
  'Card',
  'CardTitle',
  'CardBody',
  'CardFooter',
  'CardHeader',
  'Page',
  'PageSection',
  'PageSidebar',

  // Basic content
  'Alert',
  'AlertGroup',
  'Badge',
  'Label',
  'Text',
  'TextContent',
  'Title',

  // Basic lists
  'List',
  'ListItem',

  // Navigation
  'Nav',
  'NavList',
  'NavItem',
  'Breadcrumb',
  'BreadcrumbItem',

  // Tables (simplified)
  'Table',
  'Thead',
  'Tbody',
  'Tr',
  'Th',
  'Td',

  // Layout helpers
  'Stack',
  'StackItem',
  'Split',
  'SplitItem',
  'Flex',
  'FlexItem',
  'Grid',
  'GridItem',
  'Bullseye',
];

/**
 * Create a mock component that preserves props
 */
export const createMockComponent = (displayName: string, defaultElement = 'div') => {
  const MockComponent = React.forwardRef((props: any, ref: any) => {
    const { children, ...restProps } = props;

    // Add data-testid for easy selection in tests
    const testId = restProps['data-testid'] || `mock-${displayName.toLowerCase()}`;

    return React.createElement(
      defaultElement,
      {
        ...restProps,
        'data-testid': testId,
        'data-mock-component': displayName,
        ref,
      },
      children,
    );
  });

  MockComponent.displayName = `Mock${displayName}`;
  return MockComponent;
};

/**
 * Create a simplified component that renders with basic structure
 */
export const createSimplifiedComponent = (
  displayName: string,
  renderLogic?: (props: any) => React.ReactElement | null,
) => {
  const SimplifiedComponent = React.forwardRef((props: any, ref: any) => {
    if (renderLogic) {
      return renderLogic({ ...props, ref });
    }

    const { children, ...restProps } = props;
    const testId = restProps['data-testid'] || `simplified-${displayName.toLowerCase()}`;

    return React.createElement(
      'div',
      {
        ...restProps,
        'data-testid': testId,
        'data-simplified-component': displayName,
        ref,
      },
      children,
    );
  });

  SimplifiedComponent.displayName = `Simplified${displayName}`;
  return SimplifiedComponent;
};

/**
 * Special mock implementations for specific components
 */
export const specialMocks = {
  // Mock Table components to render as simple HTML table
  Table: createSimplifiedComponent('Table', (props) =>
    React.createElement('table', { ...props, role: 'table' }, props.children),
  ),
  Thead: createSimplifiedComponent('Thead', (props) =>
    React.createElement('thead', props, props.children),
  ),
  Tbody: createSimplifiedComponent('Tbody', (props) =>
    React.createElement('tbody', props, props.children),
  ),
  Tr: createSimplifiedComponent('Tr', (props) => React.createElement('tr', props, props.children)),
  Th: createSimplifiedComponent('Th', (props) => React.createElement('th', props, props.children)),
  Td: createSimplifiedComponent('Td', (props) => React.createElement('td', props, props.children)),

  // Mock Select to be a simple select element
  Select: createSimplifiedComponent('Select', (props) => {
    const { selections, onSelect, children, ...restProps } = props;
    return React.createElement(
      'select',
      {
        ...restProps,
        value: selections,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onSelect && onSelect(e, e.target.value),
      },
      children,
    );
  }),

  // Mock Modal to render children directly
  Modal: createSimplifiedComponent('Modal', (props) => {
    const { isOpen, children, ...restProps } = props;
    if (!isOpen) return null;
    return React.createElement(
      'div',
      {
        ...restProps,
        role: 'dialog',
        'aria-modal': 'true',
        'data-testid': 'mock-modal',
      },
      children,
    );
  }),

  // Mock Tabs to render all content
  Tabs: createSimplifiedComponent('Tabs', (props) => {
    const { children, activeKey, ...restProps } = props;
    return React.createElement(
      'div',
      {
        ...restProps,
        role: 'tablist',
        'data-active-key': activeKey,
      },
      children,
    );
  }),

  Tab: createSimplifiedComponent('Tab', (props) => {
    const { eventKey, title, children, ...restProps } = props;
    return React.createElement(
      'div',
      {
        ...restProps,
        role: 'tabpanel',
        'data-event-key': eventKey,
      },
      React.createElement('div', { role: 'tab' }, title),
      children,
    );
  }),
};

/**
 * Helper to determine if a component should be mocked
 */
export const shouldMockComponent = (componentName: string): boolean => {
  return COMPONENTS_TO_MOCK.includes(componentName);
};

/**
 * Helper to determine if a component should be simplified
 */
export const shouldSimplifyComponent = (componentName: string): boolean => {
  return COMPONENTS_TO_SIMPLIFY.includes(componentName);
};

/**
 * Helper to get the appropriate mock for a component
 */
export const getMockForComponent = (
  componentName: string,
): React.ComponentType<any> | undefined => {
  // Check for special mocks first
  if (componentName in specialMocks) {
    return specialMocks[componentName as keyof typeof specialMocks];
  }

  // Check if it should be fully mocked
  if (shouldMockComponent(componentName)) {
    return createMockComponent(componentName);
  }

  // Check if it should be simplified
  if (shouldSimplifyComponent(componentName)) {
    return createSimplifiedComponent(componentName);
  }

  // Return undefined to use the real component
  return undefined;
};

/**
 * Create a selective mock for PatternFly react-core
 */
export const createSelectiveMock = (actualModule: any) => {
  const selectiveMock: any = {};

  for (const exportName in actualModule) {
    const exportValue = actualModule[exportName];

    // Skip non-component exports
    if (
      typeof exportValue !== 'function' ||
      exportName.startsWith('use') ||
      exportName.startsWith('_')
    ) {
      selectiveMock[exportName] = exportValue;
      continue;
    }

    // Check if this component should be mocked
    const mockComponent = getMockForComponent(exportName);
    if (mockComponent) {
      selectiveMock[exportName] = mockComponent;
    } else {
      // Use the real component
      selectiveMock[exportName] = exportValue;
    }
  }

  return selectiveMock;
};

/**
 * Utility to setup PatternFly mocks in a test file
 *
 * Usage:
 * ```typescript
 * import { setupPatternFlyMocks } from '../__mocks__/@patternfly/selective-mocks';
 *
 * setupPatternFlyMocks();
 * ```
 */
export const setupPatternFlyMocks = () => {
  // Mock react-core with selective strategy
  vi.mock('@patternfly/react-core', async () => {
    const actual = await vi.importActual('@patternfly/react-core');
    return createSelectiveMock(actual);
  });

  // Mock react-table (always mock as it's complex)
  vi.mock('@patternfly/react-table', () => ({
    Table: createSimplifiedComponent('Table'),
    TableHeader: createSimplifiedComponent('TableHeader'),
    TableBody: createSimplifiedComponent('TableBody'),
    TableComposable: createSimplifiedComponent('TableComposable'),
    Thead: createSimplifiedComponent('Thead'),
    Tbody: createSimplifiedComponent('Tbody'),
    Tr: createSimplifiedComponent('Tr'),
    Th: createSimplifiedComponent('Th'),
    Td: createSimplifiedComponent('Td'),
    Caption: createSimplifiedComponent('Caption'),
    expandable: vi.fn(),
    sortable: vi.fn(),
    cellWidth: vi.fn(),
  }));

  // Mock react-charts (always mock due to canvas requirements)
  vi.mock('@patternfly/react-charts', () => {
    const chartComponents = [
      'Chart',
      'ChartArea',
      'ChartAxis',
      'ChartBar',
      'ChartBullet',
      'ChartDonut',
      'ChartGroup',
      'ChartLegend',
      'ChartLine',
      'ChartPie',
      'ChartScatter',
      'ChartStack',
      'ChartThreshold',
      'ChartVoronoiContainer',
    ];

    const mocks: any = {};
    chartComponents.forEach((name) => {
      mocks[name] = createMockComponent(name, 'svg');
    });

    return mocks;
  });

  // Mock react-icons (simple spans)
  vi.mock('@patternfly/react-icons', async () => {
    const actual = await vi.importActual('@patternfly/react-icons');
    const mocks: any = {};

    for (const exportName in actual) {
      if (exportName.endsWith('Icon')) {
        mocks[exportName] = createMockComponent(exportName, 'span');
      } else {
        mocks[exportName] = actual[exportName];
      }
    }

    return mocks;
  });
};

export default {
  createMockComponent,
  createSimplifiedComponent,
  createSelectiveMock,
  setupPatternFlyMocks,
  shouldMockComponent,
  shouldSimplifyComponent,
  getMockForComponent,
  COMPONENTS_TO_MOCK,
  COMPONENTS_TO_SIMPLIFY,
  COMPONENTS_TO_RENDER,
};
