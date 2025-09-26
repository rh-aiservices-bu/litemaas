import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from 'react-query';
import { configService, type BackendConfig } from '../services/config.service';

interface ConfigContextType {
  config: BackendConfig | null;
  isLoading: boolean;
  error: Error | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

/**
 * Hook to access backend configuration
 * Throws error if used outside ConfigProvider
 */
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

/**
 * ConfigProvider - Fetches and provides backend configuration
 *
 * Fetches configuration once on app init and caches indefinitely.
 * Configuration includes:
 * - Application version
 * - Usage cache TTL
 * - Environment (development/production)
 */
export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const { data, isLoading, error } = useQuery<BackendConfig, Error>(
    ['backendConfig', 'v2'], // v2: added version field
    () => configService.getConfig(),
    {
      staleTime: Infinity, // Config never becomes stale - only fetched once
      cacheTime: Infinity, // Keep in cache forever
      retry: 3, // Retry on failure (important for app init)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on component remount
    },
  );

  const value: ConfigContextType = {
    config: data || null,
    isLoading,
    error: error || null,
  };

  // Show loading state while fetching config
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        Loading configuration...
      </div>
    );
  }

  // Show error if config fetch failed
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h2>Failed to load application configuration</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
