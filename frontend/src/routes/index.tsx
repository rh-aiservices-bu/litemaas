import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import Layout from '../components/Layout';
import HomePage from '../pages/HomePage';
import ModelsPage from '../pages/ModelsPage';
import SubscriptionsPage from '../pages/SubscriptionsPage';
import ApiKeysPage from '../pages/ApiKeysPage';
import UsagePage from '../pages/UsagePage';
import LoginPage from '../pages/LoginPage';

// Root component that provides AuthContext
const Root = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

export const router = createBrowserRouter([
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
        ],
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
]);
