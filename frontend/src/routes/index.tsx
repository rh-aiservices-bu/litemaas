import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ConfigProvider } from '../contexts/ConfigContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import Layout from '../components/Layout';
import HomePage from '../pages/HomePage';
import ModelsPage from '../pages/ModelsPage';
import SubscriptionsPage from '../pages/SubscriptionsPage';
import ApiKeysPage from '../pages/ApiKeysPage';
import ChatbotPage from '../pages/ChatbotPage';
import UsagePage from '../pages/UsagePage';
import ToolsPage from '../pages/ToolsPage';
import AdminModelsPage from '../pages/AdminModelsPage';
import AdminUsagePage from '../pages/AdminUsagePage';
import AdminSubscriptionsPage from '../pages/AdminSubscriptionsPage';
import UsersPage from '../pages/UsersPage';
import LoginPage from '../pages/LoginPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';

// Create a client for React Query with standardized error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry configuration
      retry: 2, // Retry failed queries twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff (max 30s)

      // Caching configuration
      staleTime: 1000 * 60 * 5, // 5 minutes - data is "fresh" for this duration
      cacheTime: 1000 * 60 * 10, // 10 minutes - keep unused data in cache

      // Refetching configuration
      refetchOnWindowFocus: false, // Don't auto-refetch on window focus (prevents disruption)
      refetchOnReconnect: true, // Refetch when network reconnects (good UX)

      // Global error handler (fallback only - components should handle errors with useErrorHandler)
      onError: (error) => {
        // This only fires if component doesn't have its own onError handler
        // Log to console in development for debugging
        if (import.meta.env.DEV) {
          console.error('Unhandled query error:', error);
        }
      },
    },
    mutations: {
      // Mutations are more critical - don't retry automatically (may have side effects)
      retry: 0,

      // Global error handler for mutations (fallback only)
      onError: (error) => {
        if (import.meta.env.DEV) {
          console.error('Unhandled mutation error:', error);
        }
      },
    },
  },
});

// Root component that provides all contexts
const Root = () => (
  <QueryClientProvider client={queryClient}>
    <ConfigProvider>
      <AuthProvider>
        <NotificationProvider>
          <Outlet />
        </NotificationProvider>
      </AuthProvider>
    </ConfigProvider>
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
              path: 'chatbot',
              element: <ChatbotPage />,
            },
            {
              path: 'usage',
              element: <UsagePage />,
            },
            {
              path: 'admin/models',
              element: <AdminModelsPage />,
            },
            {
              path: 'admin/usage',
              element: <AdminUsagePage />,
            },
            {
              path: 'admin/users',
              element: <UsersPage />,
            },
            {
              path: 'admin/tools',
              element: <ToolsPage />,
            },
            {
              path: 'admin/subscriptions',
              element: <AdminSubscriptionsPage />,
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
