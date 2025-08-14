import React from 'react';

// Mock all PatternFly icons as simple SVG elements with proper names
const createMockIcon = (iconName: string) => {
  const MockIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => {
    return React.createElement(
      'svg',
      {
        ref,
        'data-testid': `${iconName.toLowerCase()}-icon`,
        'aria-label': iconName,
        role: 'img',
        ...props,
      },
      React.createElement('title', null, iconName),
    );
  });
  MockIcon.displayName = `Mock${iconName}`;
  return MockIcon;
};

// Navigation icons
export const HomeIcon = createMockIcon('Home');
export const CatalogIcon = createMockIcon('Catalog');
export const CubesIcon = createMockIcon('Cubes');
export const KeyIcon = createMockIcon('Key');
export const ChartLineIcon = createMockIcon('ChartLine');
export const CogIcon = createMockIcon('Cog');

// UI icons
export const BarsIcon = createMockIcon('Bars');
export const MoonIcon = createMockIcon('Moon');
export const SunIcon = createMockIcon('Sun');
export const GlobeIcon = createMockIcon('Globe');

// Common icons
export const CheckIcon = createMockIcon('Check');
export const TimesIcon = createMockIcon('Times');
export const ExclamationTriangleIcon = createMockIcon('ExclamationTriangle');
export const InfoCircleIcon = createMockIcon('InfoCircle');
export const BellIcon = createMockIcon('Bell');
export const UserIcon = createMockIcon('User');
export const SignOutAltIcon = createMockIcon('SignOutAlt');
export const ExternalLinkAltIcon = createMockIcon('ExternalLinkAlt');

// Add more icons as needed by the application
