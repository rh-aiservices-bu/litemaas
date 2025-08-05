import {
  HomeIcon,
  CatalogIcon,
  CubesIcon,
  KeyIcon,
  ChartLineIcon,
  CogIcon,
} from '@patternfly/react-icons';

import HomePage from '../pages/HomePage';
import ModelsPage from '../pages/ModelsPage';
import SubscriptionsPage from '../pages/SubscriptionsPage';
import ApiKeysPage from '../pages/ApiKeysPage';
import UsagePage from '../pages/UsagePage';
import SettingsPage from '../pages/SettingsPage';

import { AppConfig } from '../types/navigation';

export const appConfig: AppConfig = {
  appTitle: 'LiteMaaS',
  routes: [
    {
      id: 'main',
      label: 'Main',
      routes: [
        {
          id: 'home',
          path: '/home',
          element: HomePage,
          label: 'nav.home',
          icon: HomeIcon,
          exact: true,
        },
        {
          id: 'models',
          path: '/models',
          element: ModelsPage,
          label: 'nav.models',
          icon: CatalogIcon,
        },
        {
          id: 'subscriptions',
          path: '/subscriptions',
          element: SubscriptionsPage,
          label: 'nav.subscriptions',
          icon: CubesIcon,
        },
        {
          id: 'api-keys',
          path: '/api-keys',
          element: ApiKeysPage,
          label: 'nav.apiKeys',
          icon: KeyIcon,
        },
        {
          id: 'usage',
          path: '/usage',
          element: UsagePage,
          label: 'nav.usage',
          icon: ChartLineIcon,
        },
      ],
    },
    {
      id: 'settings',
      path: '/settings',
      element: SettingsPage,
      label: 'nav.settings',
      icon: CogIcon,
    },
  ],
  navigation: [
    {
      id: 'home',
      label: 'nav.home',
      path: '/home',
      icon: HomeIcon,
    },
    {
      id: 'models',
      label: 'nav.models',
      path: '/models',
      icon: CatalogIcon,
    },
    {
      id: 'subscriptions',
      label: 'nav.subscriptions',
      path: '/subscriptions',
      icon: CubesIcon,
    },
    {
      id: 'api-keys',
      label: 'nav.apiKeys',
      path: '/api-keys',
      icon: KeyIcon,
    },
    {
      id: 'usage',
      label: 'nav.usage',
      path: '/usage',
      icon: ChartLineIcon,
    },
    // Settings menu item hidden for now - uncomment when needed
    // {
    //   id: 'settings',
    //   label: 'nav.settings',
    //   path: '/settings',
    //   icon: CogIcon,
    // },
  ],
};
