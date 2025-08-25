import { describe, it, expect, vi } from 'vitest';
import { appConfig } from '../../config/navigation';
import { AppRoute, AppRouteGroup } from '../../types/navigation';

// Mock all page components
vi.mock('../../pages/HomePage', () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock('../../pages/ModelsPage', () => ({
  default: () => <div>Models Page</div>,
}));

vi.mock('../../pages/SubscriptionsPage', () => ({
  default: () => <div>Subscriptions Page</div>,
}));

vi.mock('../../pages/ApiKeysPage', () => ({
  default: () => <div>API Keys Page</div>,
}));

vi.mock('../../pages/UsagePage', () => ({
  default: () => <div>Usage Page</div>,
}));

vi.mock('../../pages/UsersPage', () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock('../../pages/SettingsPage', () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock('../../pages/ChatbotPage', () => ({
  default: () => <div>Chatbot Page</div>,
}));

// Mock PatternFly icons
vi.mock('@patternfly/react-icons', () => ({
  HomeIcon: () => <svg data-testid="home-icon" />,
  CatalogIcon: () => <svg data-testid="catalog-icon" />,
  CubesIcon: () => <svg data-testid="cubes-icon" />,
  KeyIcon: () => <svg data-testid="key-icon" />,
  ChartLineIcon: () => <svg data-testid="chart-line-icon" />,
  CogIcon: () => <svg data-testid="cog-icon" />,
  CommentsIcon: () => <svg data-testid="chat-icon" />,
  UsersIcon: () => <svg data-testid="users-icon" />,
}));

describe('Navigation Configuration', () => {
  it('has correct app title', () => {
    expect(appConfig.appTitle).toBe('LiteMaaS');
  });

  it('has correct route structure', () => {
    expect(appConfig.routes).toBeDefined();
    expect(appConfig.routes).toHaveLength(2); // Main group + Settings

    const mainGroup = appConfig.routes[0] as AppRouteGroup;
    expect(mainGroup.id).toBe('main');
    expect(mainGroup.label).toBe('Main');
    expect(mainGroup.routes).toHaveLength(6); // Home, Models, Subscriptions, API Keys, Chatbot, Usage

    const settingsRoute = appConfig.routes[1] as AppRoute;
    expect(settingsRoute.id).toBe('admin');
    expect(settingsRoute.label).toBe('Admin');
    expect(mainGroup.routes).toHaveLength(6); // Users, Settings
  });

  it('has correct navigation structure', () => {
    expect(appConfig.navigation).toBeDefined();
    expect(appConfig.navigation).toHaveLength(10); // Home, Models, Subscriptions, API Keys, Chatbot, Usage, Users, Settings
  });

  describe('Route Configuration', () => {
    it('has correct home route', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const homeRoute = mainGroup.routes.find((route: AppRoute) => route.id === 'home');

      expect(homeRoute).toBeDefined();
      expect(homeRoute?.path).toBe('/home');
      expect(homeRoute?.label).toBe('nav.home');
      expect(homeRoute?.exact).toBe(true);
      expect(homeRoute?.element).toBeDefined();
      expect(homeRoute?.icon).toBeDefined();
    });

    it('has correct models route', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const modelsRoute = mainGroup.routes.find((route: AppRoute) => route.id === 'models');

      expect(modelsRoute).toBeDefined();
      expect(modelsRoute?.path).toBe('/models');
      expect(modelsRoute?.label).toBe('nav.models');
      expect(modelsRoute?.element).toBeDefined();
      expect(modelsRoute?.icon).toBeDefined();
    });

    it('has correct subscriptions route', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const subscriptionsRoute = mainGroup.routes.find(
        (route: AppRoute) => route.id === 'subscriptions',
      );

      expect(subscriptionsRoute).toBeDefined();
      expect(subscriptionsRoute?.path).toBe('/subscriptions');
      expect(subscriptionsRoute?.label).toBe('nav.subscriptions');
      expect(subscriptionsRoute?.element).toBeDefined();
      expect(subscriptionsRoute?.icon).toBeDefined();
    });

    it('has correct api-keys route', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const apiKeysRoute = mainGroup.routes.find((route: AppRoute) => route.id === 'api-keys');

      expect(apiKeysRoute).toBeDefined();
      expect(apiKeysRoute?.path).toBe('/api-keys');
      expect(apiKeysRoute?.label).toBe('nav.apiKeys');
      expect(apiKeysRoute?.element).toBeDefined();
      expect(apiKeysRoute?.icon).toBeDefined();
    });

    it('has correct usage route', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const usageRoute = mainGroup.routes.find((route: AppRoute) => route.id === 'usage');

      expect(usageRoute).toBeDefined();
      expect(usageRoute?.path).toBe('/usage');
      expect(usageRoute?.label).toBe('nav.usage');
      expect(usageRoute?.element).toBeDefined();
      expect(usageRoute?.icon).toBeDefined();
    });
  });

  describe('Navigation Configuration', () => {
    it('has correct home navigation item', () => {
      const homeNav = appConfig.navigation.find((nav) => nav.id === 'home');

      expect(homeNav).toBeDefined();
      expect(homeNav?.path).toBe('/home');
      expect(homeNav?.label).toBe('nav.home');
      expect(homeNav?.icon).toBeDefined();
    });

    it('has correct models navigation item', () => {
      const modelsNav = appConfig.navigation.find((nav) => nav.id === 'models');

      expect(modelsNav).toBeDefined();
      expect(modelsNav?.path).toBe('/models');
      expect(modelsNav?.label).toBe('nav.models');
      expect(modelsNav?.icon).toBeDefined();
    });

    it('has correct subscriptions navigation item', () => {
      const subscriptionsNav = appConfig.navigation.find((nav) => nav.id === 'subscriptions');

      expect(subscriptionsNav).toBeDefined();
      expect(subscriptionsNav?.path).toBe('/subscriptions');
      expect(subscriptionsNav?.label).toBe('nav.subscriptions');
      expect(subscriptionsNav?.icon).toBeDefined();
    });

    it('has correct api-keys navigation item', () => {
      const apiKeysNav = appConfig.navigation.find((nav) => nav.id === 'api-keys');

      expect(apiKeysNav).toBeDefined();
      expect(apiKeysNav?.path).toBe('/api-keys');
      expect(apiKeysNav?.label).toBe('nav.apiKeys');
      expect(apiKeysNav?.icon).toBeDefined();
    });

    it('has correct usage navigation item', () => {
      const usageNav = appConfig.navigation.find((nav) => nav.id === 'usage');

      expect(usageNav).toBeDefined();
      expect(usageNav?.path).toBe('/usage');
      expect(usageNav?.label).toBe('nav.usage');
      expect(usageNav?.icon).toBeDefined();
    });

    // TODO Add tests for Users and Settings
  });

  describe('Icon Configuration', () => {
    it('has correct icon components for all routes', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const routes: AppRoute[] = mainGroup.routes;

      routes.forEach((route: AppRoute) => {
        expect(route.icon).toBeDefined();
        expect(typeof route.icon).toBe('function'); // React component
      });
    });

    it('has correct icon components for all navigation items', () => {
      appConfig.navigation
        .filter((navItem) => navItem.id !== 'admin-separator')
        .forEach((navItem) => {
          expect(navItem.icon).toBeDefined();
          expect(typeof navItem.icon).toBe('function'); // React component
        });
    });
  });

  describe('Internationalization Labels', () => {
    it('uses correct i18n keys for routes', () => {
      const expectedLabels = [
        'nav.home',
        'nav.models',
        'nav.subscriptions',
        'nav.apiKeys',
        'nav.chatbot',
        'nav.usage',
        'nav.admin.users',
        'nav.admin.settings',
      ];

      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const routes: AppRoute[] = mainGroup.routes;

      routes.forEach((route: AppRoute) => {
        expect(expectedLabels).toContain(route.label);
      });
    });

    it('uses correct i18n keys for navigation', () => {
      const expectedLabels = [
        'nav.home',
        'nav.models',
        'nav.subscriptions',
        'nav.apiKeys',
        'nav.chatbot',
        'nav.usage',
        'nav.admin.users',
        'nav.admin.tools',
        'nav.admin.models',
      ];

      appConfig.navigation
        .filter((navItem) => navItem.id !== 'admin-separator')
        .forEach((navItem) => {
          expect(expectedLabels).toContain(navItem.label);
        });
    });
  });

  describe('Path Configuration', () => {
    it('has consistent paths between routes and navigation', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const routes: AppRoute[] = mainGroup.routes;

      routes.forEach((route: AppRoute) => {
        const correspondingNav = appConfig.navigation.find((nav) => nav.id === route.id);
        if (correspondingNav) {
          expect(correspondingNav.path).toBe(route.path);
        }
      });
    });

    it('has all paths starting with / or /admin', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const mainRoutes: AppRoute[] = mainGroup.routes;
      const adminGroup = appConfig.routes[1] as AppRouteGroup;
      const adminRoutes: AppRoute[] = adminGroup.routes;

      mainRoutes.forEach((route: AppRoute) => {
        expect(route.path).toMatch(/^\/[a-z-]+$/);
      });

      adminRoutes.forEach((route: AppRoute) => {
        expect(route.path).toMatch(/^\/admin(\/|$)/);
      });

      appConfig.navigation
        .filter((navItem) => navItem.id !== 'admin-separator')
        .forEach((navItem) => {
          expect(navItem.path).toMatch(/^\/[a-z0-9-/]+$/);
        });
    });
  });

  describe('Route Elements', () => {
    it('has valid React components for all route elements', () => {
      const mainGroup = appConfig.routes[0] as AppRouteGroup;
      const routes: AppRoute[] = mainGroup.routes;

      routes.forEach((route: AppRoute) => {
        expect(route.element).toBeDefined();
        expect(typeof route.element).toBe('function'); // React component
      });
    });
  });
});
