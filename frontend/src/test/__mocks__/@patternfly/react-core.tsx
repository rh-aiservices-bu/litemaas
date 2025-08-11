/**
 * Minimal PatternFly React Core Mock
 *
 * Based on HomePage test success, most PatternFly components work fine in tests
 * and should render naturally. Only mock components that truly cause issues.
 *
 * Philosophy: Mock as little as possible, let components render naturally
 */

import React from 'react';
import { vi } from 'vitest';

// Helper to create a minimal mock for truly problematic components
const createMinimalMock = (displayName: string, element = 'div') => {
  const MockComponent = React.forwardRef<any, any>((props: any, ref) => {
    const { children, className, ...rest } = props;
    return React.createElement(
      element,
      {
        ref,
        ...rest,
        className: className,
        'data-testid': props['data-testid'] || `mock-${displayName.toLowerCase()}`,
      },
      children,
    );
  });
  MockComponent.displayName = `Mock${displayName}`;
  return MockComponent;
};

// Only mock components that cause real issues in tests
// Based on analysis: charts, complex dropdowns, date pickers, file uploads, etc.

// Chart components - require canvas context, always mock
export const Chart = createMinimalMock('Chart', 'svg');
export const ChartArea = createMinimalMock('ChartArea', 'g');
export const ChartAxis = createMinimalMock('ChartAxis', 'g');
export const ChartBar = createMinimalMock('ChartBar', 'g');
export const ChartBullet = createMinimalMock('ChartBullet', 'svg');
export const ChartDonut = createMinimalMock('ChartDonut', 'svg');
export const ChartGroup = createMinimalMock('ChartGroup', 'g');
export const ChartLegend = createMinimalMock('ChartLegend', 'g');
export const ChartLine = createMinimalMock('ChartLine', 'g');
export const ChartPie = createMinimalMock('ChartPie', 'svg');
export const ChartScatter = createMinimalMock('ChartScatter', 'g');
export const ChartStack = createMinimalMock('ChartStack', 'g');
export const ChartThreshold = createMinimalMock('ChartThreshold', 'g');
export const ChartVoronoiContainer = createMinimalMock('ChartVoronoiContainer', 'g');

// Complex form components that have positioning/measurement issues
export const Select = React.forwardRef<any, any>((props: any, ref) => {
  const { children, selections, onSelect, isOpen, ...rest } = props;
  return React.createElement(
    'select',
    {
      ref,
      ...rest,
      value: Array.isArray(selections) ? selections[0] : selections,
      onChange: (e: any) => onSelect && onSelect(e, e.target.value),
      'data-testid': props['data-testid'] || 'mock-select',
    },
    children,
  );
});
Select.displayName = 'MockSelect';

export const SelectOption = React.forwardRef<any, any>((props: any, ref) => {
  const { children, value, ...rest } = props;
  return React.createElement(
    'option',
    {
      ref,
      ...rest,
      value,
      'data-testid': props['data-testid'] || 'mock-select-option',
    },
    children,
  );
});
SelectOption.displayName = 'MockSelectOption';

// Date/time components - cause issues with Popper positioning
export const DatePicker = createMinimalMock('DatePicker', 'input');
export const TimePicker = createMinimalMock('TimePicker', 'input');

// File upload - causes issues with file handling in tests
export const FileUpload = React.forwardRef<any, any>((props: any, ref) => {
  const { filename, onChange, ...rest } = props;
  return React.createElement(
    'div',
    {
      ref,
      ...rest,
      'data-testid': props['data-testid'] || 'mock-file-upload',
    },
    React.createElement('input', {
      type: 'file',
      onChange: (e: any) => onChange && onChange(e, e.target.files?.[0]),
    }),
    filename && React.createElement('span', null, filename),
  );
});
FileUpload.displayName = 'MockFileUpload';

// Heavy wizard component
export const Wizard = createMinimalMock('Wizard');

// Code editor - Monaco issues in tests
export const CodeEditor = React.forwardRef<any, any>((props: any, ref) => {
  const { code, onChange, language, ...rest } = props;
  return React.createElement('textarea', {
    ref,
    ...rest,
    value: code,
    onChange: (e: any) => onChange && onChange(e.target.value),
    'data-language': language,
    'data-testid': props['data-testid'] || 'mock-code-editor',
  });
});
CodeEditor.displayName = 'MockCodeEditor';

// Components with ResizeObserver dependencies
export const Truncate = createMinimalMock('Truncate', 'span');

// LoginPage component - needs proper structure for tests
export const LoginPage = React.forwardRef<any, any>((props: any, ref) => {
  const {
    children,
    brandImgSrc,
    brandImgAlt,
    backgroundImgSrc,
    loginTitle,
    loginSubtitle,
    className,
    ...rest
  } = props;

  return (
    <div
      ref={ref}
      {...rest}
      className={className}
      data-testid={props['data-testid'] || 'mock-login-page'}
    >
      {brandImgSrc && <img src={brandImgSrc} alt={brandImgAlt} data-testid="login-brand-image" />}
      {loginTitle && <h1>{loginTitle}</h1>}
      {loginSubtitle && <p>{loginSubtitle}</p>}
      {children}
    </div>
  );
});
LoginPage.displayName = 'MockLoginPage';

// PatternFly 6 Dropdown components
export const Dropdown = React.forwardRef<any, any>((props: any, ref) => {
  const { children, isOpen, onSelect, onOpenChange, toggle, ...rest } = props;
  return (
    <div
      ref={ref}
      {...rest}
      data-is-open={isOpen}
      data-testid={props['data-testid'] || 'mock-dropdown'}
    >
      {toggle &&
        React.cloneElement(toggle(React.createRef()), {
          onClick: () => onOpenChange && onOpenChange(!isOpen),
        })}
      {isOpen && children}
    </div>
  );
});
Dropdown.displayName = 'MockDropdown';

export const DropdownList = React.forwardRef<any, any>((props: any, ref) => {
  const { children, ...rest } = props;
  return (
    <ul ref={ref} {...rest} role="menu" data-testid={props['data-testid'] || 'mock-dropdown-list'}>
      {children}
    </ul>
  );
});
DropdownList.displayName = 'MockDropdownList';

export const DropdownItem = React.forwardRef<any, any>((props: any, ref) => {
  const { children, onClick, ...rest } = props;
  return (
    <li
      ref={ref}
      {...rest}
      role="menuitem"
      onClick={onClick}
      data-testid={props['data-testid'] || 'mock-dropdown-item'}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </li>
  );
});
DropdownItem.displayName = 'MockDropdownItem';

export const MenuToggle = React.forwardRef<any, any>((props: any, ref) => {
  const { children, onClick, icon, variant, 'aria-label': ariaLabel, ...rest } = props;
  return (
    <button
      ref={ref}
      {...rest}
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      data-variant={variant}
      data-testid={props['data-testid'] || 'mock-menu-toggle'}
    >
      {icon && <span data-testid="toggle-icon">{icon}</span>}
      {children}
    </button>
  );
});
MenuToggle.displayName = 'MockMenuToggle';

// Export hook mocks
export const useBreakpointHook = vi.fn(() => ({
  lgUp: false,
  mdUp: false,
  smUp: false,
  xlUp: false,
}));

// Export commonly used enums/constants that don't cause issues
export const ContentVariants = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  a: 'a',
  small: 'small',
  blockquote: 'blockquote',
  pre: 'pre',
};

// Button variants
export const ButtonVariant = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  danger: 'danger',
  warning: 'warning',
  link: 'link',
  plain: 'plain',
  control: 'control',
};

// Size variants
export const Size = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
};

// Color variants
export const Color = {
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  red: 'red',
  purple: 'purple',
  cyan: 'cyan',
  gold: 'gold',
  grey: 'grey',
};

// Export interfaces for TypeScript
export interface ButtonProps {
  children?: React.ReactNode;
  className?: string;
  variant?: string;
  size?: string;
  isDisabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface SelectProps {
  children?: React.ReactNode;
  selections?: string | string[];
  onSelect?: (event: React.FormEvent, selection: string) => void;
  isOpen?: boolean;
  className?: string;
}

// Drawer components (needed for NotificationDrawer tests)
export const Drawer = ({ children, isExpanded, onExpand, ...props }: any) => {
  const DrawerComponent = (
    <div data-testid="pf-drawer" data-expanded={isExpanded} {...props}>
      {children}
    </div>
  );
  return DrawerComponent;
};

export const DrawerContent = ({ children, ...props }: any) => (
  <div data-testid="pf-drawer-content" {...props}>
    {children}
  </div>
);

export const DrawerContentBody = ({ children, ...props }: any) => (
  <div data-testid="pf-drawer-content-body" {...props}>
    {children}
  </div>
);

export const DrawerPanelContent = ({ children, ...props }: any) => (
  <div data-testid="pf-drawer-panel-content" {...props}>
    {children}
  </div>
);

export const DrawerHead = ({ children, ...props }: any) => (
  <div data-testid="pf-drawer-head" {...props}>
    {children}
  </div>
);

export const DrawerActions = ({ children, ...props }: any) => (
  <div data-testid="pf-drawer-actions" {...props}>
    {children}
  </div>
);

export const DrawerCloseButton = ({ onClick, ...props }: any) => (
  <button data-testid="pf-drawer-close" onClick={onClick} {...props} />
);

// Notification Drawer components (extending base Drawer functionality)
export const NotificationDrawer = ({ children, ...props }: any) => (
  <div data-testid="pf-notification-drawer" {...props}>
    {children}
  </div>
);

export const NotificationDrawerHeader = ({ children, count, onClose, ...props }: any) => (
  <div data-testid="pf-notification-drawer-header" data-count={count} {...props}>
    {children}
    {onClose && (
      <button onClick={onClose} data-testid="close-drawer">
        ×
      </button>
    )}
  </div>
);

export const NotificationDrawerBody = ({ children, ...props }: any) => (
  <div data-testid="pf-notification-drawer-body" {...props}>
    {children}
  </div>
);

export const NotificationDrawerList = ({ children, ...props }: any) => (
  <ul data-testid="pf-notification-drawer-list" {...props}>
    {children}
  </ul>
);

export const NotificationDrawerListItem = ({
  children,
  variant,
  isRead,
  onClick,
  ...props
}: any) => (
  <li
    data-testid="pf-notification-drawer-list-item"
    data-variant={variant}
    data-read={isRead}
    onClick={onClick}
    className={`pf-v6-c-notification-drawer__list-item ${!isRead ? 'pf-m-unread' : ''}`}
    {...props}
  >
    {children}
  </li>
);

export const NotificationDrawerListItemHeader = ({
  children,
  variant,
  title,
  srTitle,
  ...props
}: any) => (
  <div data-testid="pf-notification-drawer-list-item-header" data-variant={variant} {...props}>
    <h4>{title || children}</h4>
    {srTitle && <span className="pf-v6-screen-reader">{srTitle}</span>}
  </div>
);

export const NotificationDrawerListItemBody = ({ children, timestamp, ...props }: any) => (
  <div data-testid="pf-notification-drawer-list-item-body" {...props}>
    {children}
    {timestamp && <div data-testid="timestamp">{timestamp}</div>}
  </div>
);

/**
 * IMPORTANT NOTES:
 *
 * 1. All other PatternFly components (Page, Card, Button, Form, etc.) are NOT mocked
 *    They render naturally and work perfectly in tests as seen in HomePage success
 *
 * 2. Only components in this file are mocked due to specific technical issues:
 *    - Charts: Canvas context requirements
 *    - Select/DatePicker: Popper positioning issues
 *    - FileUpload: File handling complexity
 *    - CodeEditor: Monaco editor dependencies
 *    - Wizard: Heavy component with complex state
 *    - Drawer: Complex positioning and state management
 *
 * 3. This approach allows 95%+ of PatternFly components to render naturally
 *    providing much better test coverage and realistic component behavior
 *
 * 4. If a component works in tests, DO NOT mock it!
 */
