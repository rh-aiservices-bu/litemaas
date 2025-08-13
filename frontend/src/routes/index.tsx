import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import Layout from '../components/Layout';
import HomePage from '../pages/HomePage';
import ModelsPage from '../pages/ModelsPage';
import SubscriptionsPage from '../pages/SubscriptionsPage';
import ApiKeysPage from '../pages/ApiKeysPage';
import UsagePage from '../pages/UsagePage';
import SettingsPage from '../pages/SettingsPage';
import LoginPage from '../pages/LoginPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

// Root component that provides all contexts
const Root = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationProvider>
        <Outlet />
      </NotificationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Root />,
      children: [
        {
          path: '/',
          element: (
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <Navigate to="/home" replace />,
            },
            {
              path: 'home',
              element: <HomePage />,
            },
            {
              path: 'models',
              element: <ModelsPage />,
            },
            {
              path: 'subscriptions',
              element: <SubscriptionsPage />,
            },
            {
              path: 'api-keys',
              element: <ApiKeysPage />,
            },
            {
              path: 'usage',
              element: <UsagePage />,
            },
            {
              path: 'settings',
              element: <SettingsPage />,
            },
          ],
        },
        {
          path: '/login',
          element: <LoginPage />,
        },
        {
          path: '/auth/callback',
          element: <AuthCallbackPage />,
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
