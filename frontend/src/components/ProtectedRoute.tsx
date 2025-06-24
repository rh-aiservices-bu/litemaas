import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bullseye, 
  Spinner, 
  EmptyState
} from '@patternfly/react-core';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Bullseye>
        <EmptyState>
          <Spinner size="xl" />
          <div style={{ marginTop: '1rem' }}>
            <h4>Loading...</h4>
            <p>Checking authentication status...</p>
          </div>
        </EmptyState>
      </Bullseye>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
