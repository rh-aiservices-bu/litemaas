import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { brandingService, type BrandingSettings } from '../services/branding.service';

interface BrandingContextType {
  brandingSettings: BrandingSettings | null;
  isLoading: boolean;
  refetch: () => void;
}

const defaultSettings: BrandingSettings = {
  loginLogoEnabled: false,
  hasLoginLogo: false,
  loginTitleEnabled: false,
  loginTitle: null,
  loginSubtitleEnabled: false,
  loginSubtitle: null,
  headerBrandEnabled: false,
  hasHeaderBrandLight: false,
  hasHeaderBrandDark: false,
  updatedAt: null,
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<BrandingSettings>(
    ['brandingSettings'],
    () => brandingService.getSettings(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
      // Don't block rendering on failure - use defaults
      onError: (error) => {
        console.error('Failed to fetch branding settings:', error);
      },
    },
  );

  const refetch = () => {
    queryClient.invalidateQueries(['brandingSettings']);
  };

  const value: BrandingContextType = {
    brandingSettings: data ?? defaultSettings,
    isLoading,
    refetch,
  };

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};
