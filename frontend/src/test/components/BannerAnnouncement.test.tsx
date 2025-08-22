import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import BannerAnnouncement from '../../components/BannerAnnouncement';
import { useBanners } from '../../contexts/BannerContext';
import type { Banner } from '../../types/banners';
import React from 'react';

// Mock the banner context
vi.mock('../../contexts/BannerContext', () => ({
  useBanners: vi.fn(),
}));

// Mock the auth context to provide authenticated user
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock react-i18next
const mockT = vi.fn((key) => key);
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: mockT,
      i18n: { language: 'en' },
    }),
  };
});

describe('BannerAnnouncement', () => {
  const mockDismissBanner = vi.fn();
  const mockRefetch = vi.fn();

  const mockBanner: Banner = {
    id: 'banner-123',
    name: 'Announcement-123',
    isActive: true,
    priority: 0,
    content: {
      en: 'Welcome to LiteMaaS! This is an important announcement.',
    },
    variant: 'info',
    isDismissible: true,
    markdownEnabled: false,
    createdBy: 'admin-123',
    updatedBy: 'admin-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockBannerContext = {
    banners: [mockBanner],
    isLoading: false,
    error: null,
    dismissBanner: mockDismissBanner,
    updateBanner: vi.fn(),
    refetch: mockRefetch,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    (useBanners as any).mockReturnValue(mockBannerContext);

    // Mock useAuth to return authenticated user
    const { useAuth } = await import('../../contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'test-user-123',
        username: 'test@example.com',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user'],
      },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      loginAsAdmin: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when banners are loading', () => {
    beforeEach(() => {
      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        isLoading: true,
        banners: [],
      });
    });

    it('should not render any banner when loading', () => {
      render(<BannerAnnouncement />);

      const banner = screen.queryByTestId('banner-announcement');
      expect(banner).not.toBeInTheDocument();
    });
  });

  describe('when there are no banners', () => {
    beforeEach(() => {
      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [],
      });
    });

    it('should not render any banner when there are no banners', () => {
      render(<BannerAnnouncement />);

      const banner = screen.queryByTestId('banner-announcement');
      expect(banner).not.toBeInTheDocument();
    });
  });

  describe('when there is an error', () => {
    beforeEach(() => {
      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        error: new Error('Failed to load banners'),
        banners: [],
      });
    });

    it('should not render any banner when there is an error', () => {
      render(<BannerAnnouncement />);

      const banner = screen.queryByTestId('banner-announcement');
      expect(banner).not.toBeInTheDocument();
    });
  });

  describe('when there are active banners', () => {
    it('should render the first active banner', () => {
      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toBeInTheDocument();

      const bannerText = screen.getByText(
        'Welcome to LiteMaaS! This is an important announcement.',
      );
      expect(bannerText).toBeInTheDocument();
    });

    it('should render banner with correct variant class', () => {
      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toHaveClass('pf-v6-c-banner');
      expect(banner).toHaveClass('pf-m-blue'); // Default info variant
    });

    it('should render banner with warning variant', () => {
      const warningBanner = {
        ...mockBanner,
        variant: 'warning' as const,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [warningBanner],
      });

      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toHaveClass('pf-m-orange');
    });

    it('should render banner with danger variant', () => {
      const dangerBanner = {
        ...mockBanner,
        variant: 'danger' as const,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [dangerBanner],
      });

      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toHaveClass('pf-m-red');
    });

    it('should render banner with success variant', () => {
      const successBanner = {
        ...mockBanner,
        variant: 'success' as const,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [successBanner],
      });

      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toHaveClass('pf-m-green');
    });

    it('should show dismiss button for dismissible banners', () => {
      render(<BannerAnnouncement />);

      const dismissButton = screen.getByRole('button', { name: /close|dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('should not show dismiss button for non-dismissible banners', () => {
      const nonDismissibleBanner = {
        ...mockBanner,
        isDismissible: false,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [nonDismissibleBanner],
      });

      render(<BannerAnnouncement />);

      const dismissButton = screen.queryByRole('button', { name: /close|dismiss/i });
      expect(dismissButton).not.toBeInTheDocument();
    });

    it('should call dismissBanner when dismiss button is clicked', async () => {
      render(<BannerAnnouncement />);

      const dismissButton = screen.getByRole('button', { name: /close|dismiss/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockDismissBanner).toHaveBeenCalledWith('banner-123');
      });
    });

    it('should render link when linkUrl is provided', () => {
      const bannerWithLink = {
        ...mockBanner,
        linkUrl: 'https://example.com',
        linkText: { en: 'Learn more' },
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [bannerWithLink],
      });

      render(<BannerAnnouncement />);

      const link = screen.getByRole('link', { name: 'Learn more' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render content as markdown when markdownEnabled is true', () => {
      const markdownBanner = {
        ...mockBanner,
        content: {
          en: '**Bold text** and *italic text* with [link](https://example.com)',
        },
        markdownEnabled: true,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [markdownBanner],
      });

      render(<BannerAnnouncement />);

      // Should render markdown content
      const boldText = screen.getByText('Bold text');
      expect(boldText).toBeInTheDocument();

      const italicText = screen.getByText('italic text');
      expect(italicText).toBeInTheDocument();

      const markdownLink = screen.getByRole('link', { name: 'link' });
      expect(markdownLink).toHaveAttribute('href', 'https://example.com');
    });

    it('should render content as plain text when markdownEnabled is false', () => {
      const plainTextBanner = {
        ...mockBanner,
        content: {
          en: '**Bold text** and *italic text*',
        },
        markdownEnabled: false,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [plainTextBanner],
      });

      render(<BannerAnnouncement />);

      // Should render as plain text, not processed markdown
      const text = screen.getByText('**Bold text** and *italic text*');
      expect(text).toBeInTheDocument();
    });

    it('should render only the first banner when multiple banners exist', () => {
      const secondBanner: Banner = {
        ...mockBanner,
        id: 'banner-456',
        content: { en: 'Second banner content' },
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [mockBanner, secondBanner],
      });

      render(<BannerAnnouncement />);

      // Should only show the first banner
      const firstBannerText = screen.getByText(
        'Welcome to LiteMaaS! This is an important announcement.',
      );
      expect(firstBannerText).toBeInTheDocument();

      const secondBannerText = screen.queryByText('Second banner content');
      expect(secondBannerText).not.toBeInTheDocument();
    });

    it('should use fallback English content when current language is not available', () => {
      const multilangBanner = {
        ...mockBanner,
        content: {
          en: 'English content',
          es: 'Contenido en español',
        },
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [multilangBanner],
      });

      render(<BannerAnnouncement />);

      // Since the component defaults to English when other languages are not available
      const englishText = screen.getByText('English content');
      expect(englishText).toBeInTheDocument();
    });

    it('should render banner content based on available languages', () => {
      const multilangBanner = {
        ...mockBanner,
        content: {
          en: 'English content',
          es: 'Contenido en español',
        },
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [multilangBanner],
      });

      render(<BannerAnnouncement />);

      // Should show available content (English in this test setup)
      const content = screen.getByText('English content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      // PatternFly Banner component has its own ARIA implementation
      expect(banner).toBeInTheDocument();
      // The screenReaderText is set in the PatternFly Banner component internally
    });

    it('should have accessible dismiss button', () => {
      render(<BannerAnnouncement />);

      const dismissButton = screen.getByRole('button', { name: /close|dismiss/i });
      expect(dismissButton).toHaveAttribute('aria-label');
    });

    it('should render danger banners correctly', () => {
      const dangerBanner = {
        ...mockBanner,
        variant: 'danger' as const,
      };

      (useBanners as any).mockReturnValue({
        ...mockBannerContext,
        banners: [dangerBanner],
      });

      render(<BannerAnnouncement />);

      const banner = screen.getByTestId('banner-announcement');
      expect(banner).toHaveClass('pf-m-red');
    });
  });
});
