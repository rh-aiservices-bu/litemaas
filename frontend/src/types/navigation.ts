import { ComponentType } from 'react';

export interface AppRoute {
  id: string;
  path: string;
  element: ComponentType;
  label: string;
  icon?: ComponentType;
  exact?: boolean;
  children?: AppRoute[];
  requiredRoles?: string[];
}

export interface AppRouteGroup {
  id: string;
  label: string;
  routes: AppRoute[];
}

export interface NavigationItem {
  id: string;
  label: string;
  path?: string;
  icon?: ComponentType;
  children?: NavigationItem[];
  isGroup?: boolean;
  requiredRoles?: string[];
}

export interface AppConfig {
  appTitle: string;
  routes: (AppRoute | AppRouteGroup)[];
  navigation: NavigationItem[];
}
