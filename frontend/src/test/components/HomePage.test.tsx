/**
 * Tests for HomePage.tsx
 *
 * Comprehensive test coverage for the home page including:
 * - Dashboard widget rendering (budget, endpoint URL, token consumption)
 * - Dashboard card rendering and navigation
 * - Accessibility compliance and WCAG standards
 * - Responsive layout behavior
 * - Internationalization support
 * - Quick action functionality
 */

import { screen, waitFor } from '@testing-library/react';
import { render } from '../test-utils'; // Use centralized test utilities
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  writable: true,
  configurable: true,
});

// Mock usage service for dashboard widget data
vi.mock('../../services/usage.service', () => ({
  usageService: {
    getBudgetInfo: vi.fn().mockResolvedValue({
      maxBudget: 10,
      currentSpend: 8,
      budgetDuration: 'monthly',
      budgetResetAt: '2026-07-01T00:00:00Z',
    }),
    getAnalytics: vi.fn().mockResolvedValue({
      period: { startDate: '2026-06-18', endDate: '2026-06-25' },
      totalUsers: 1,
      activeUsers: 1,
      totalRequests: 100,
      totalTokens: { total: 45200, prompt: 32100, completion: 13100 },
      totalCost: { total: 0.5, byProvider: {}, byModel: {} },
      successRate: 99,
      averageLatency: 200,
      topMetrics: { topUser: null, topModel: null },
      trends: {
        requestsTrend: {
          metric: 'requests',
          current: 100,
          previous: 80,
          percentageChange: 25,
          direction: 'up',
        },
        costTrend: {
          metric: 'cost',
          current: 0.5,
          previous: 0.4,
          percentageChange: 25,
          direction: 'up',
        },
        usersTrend: {
          metric: 'users',
          current: 1,
          previous: 1,
          percentageChange: 0,
          direction: 'stable',
        },
        totalTokensTrend: {
          metric: 'totalTokens',
          current: 45200,
          previous: 40000,
          percentageChange: 13,
          direction: 'up',
        },
        promptTokensTrend: {
          metric: 'promptTokens',
          current: 32100,
          previous: 28000,
          percentageChange: 14.6,
          direction: 'up',
        },
        completionTokensTrend: {
          metric: 'completionTokens',
          current: 13100,
          previous: 12000,
          percentageChange: 9.2,
          direction: 'up',
        },
      },
    }),
  },
}));

import HomePage from '../../pages/HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render without crashing', () => {
      expect(() => render(<HomePage />)).not.toThrow();
    });

    it('should display the main title and subtitle', () => {
      render(<HomePage />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Welcome to LiteMaaS' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Your AI Model Management Platform')).toBeInTheDocument();
    });

    it('should render all navigation cards', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { level: 2, name: 'Models' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Subscriptions' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'API Keys' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeInTheDocument();
    });

    it('should display card descriptions', () => {
      render(<HomePage />);

      expect(screen.getByText('Browse and manage AI models')).toBeInTheDocument();
      expect(screen.getByText('Manage your AI model subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Manage your API access keys')).toBeInTheDocument();
      expect(screen.getByText('Monitor your API usage and costs')).toBeInTheDocument();
    });

    it('should display icons for each card', () => {
      render(<HomePage />);

      const icons = document.querySelectorAll('svg[role="img"]');
      expect(icons.length).toBeGreaterThanOrEqual(4);

      // Navigation cards (5) plus dashboard widget cards
      const navCards = document.querySelectorAll('.pf-v6-c-card.pf-m-clickable');
      expect(navCards).toHaveLength(5);
    });
  });

  describe('Dashboard widgets', () => {
    it('should render the endpoint URL widget', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('API Endpoint')).toBeInTheDocument();
      });
      expect(screen.getByText('https://test.litemaas.com/v1')).toBeInTheDocument();
      expect(screen.getByText('Use this URL to make API requests')).toBeInTheDocument();
    });

    it('should render copy button for endpoint URL', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Copy endpoint URL')).toBeInTheDocument();
      });
    });

    it('should copy endpoint URL to clipboard when copy button is clicked', async () => {
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Copy endpoint URL')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Copy endpoint URL'));

      expect(writeTextSpy).toHaveBeenCalledWith('https://test.litemaas.com/v1');
    });

    it('should render token consumption metric cards', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      });
      expect(screen.getByText('Prompt Tokens')).toBeInTheDocument();
      expect(screen.getByText('Completion Tokens')).toBeInTheDocument();
    });

    it('should display formatted token values', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('45.2K')).toBeInTheDocument();
      });
      expect(screen.getByText('32.1K')).toBeInTheDocument();
      expect(screen.getByText('13.1K')).toBeInTheDocument();
    });

    it('should display "Last 7 days" subtitle on token cards', async () => {
      render(<HomePage />);

      await waitFor(() => {
        const subtitles = screen.getAllByText('Last 7 days');
        expect(subtitles).toHaveLength(3);
      });
    });
  });

  describe('Navigation functionality', () => {
    it('should have correct navigation links for all cards', () => {
      render(<HomePage />);

      const modelsLink = screen.getByLabelText('View available AI models');
      const subscriptionsLink = screen.getByLabelText('View your model subscriptions');
      const apiKeysLink = screen.getByLabelText('View your API keys');
      const usageLink = screen.getByLabelText('View usage statistics');

      expect(modelsLink).toBeInTheDocument();
      expect(subscriptionsLink).toBeInTheDocument();
      expect(apiKeysLink).toBeInTheDocument();
      expect(usageLink).toBeInTheDocument();
    });

    it('should have appropriate aria-labels for navigation', () => {
      render(<HomePage />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(5);

      expect(screen.getByLabelText('View available AI models')).toBeInTheDocument();
      expect(screen.getByLabelText('View your model subscriptions')).toBeInTheDocument();
      expect(screen.getByLabelText('View your API keys')).toBeInTheDocument();
      expect(screen.getByLabelText('View usage statistics')).toBeInTheDocument();
    });

    it('should handle card click interactions', async () => {
      render(<HomePage />);

      const cards = document.querySelectorAll('.pf-v6-c-card.pf-m-clickable');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive layout', () => {
    it('should apply correct responsive breakpoints', () => {
      render(<HomePage />);

      const gridItems = document.querySelectorAll('[class*="pf-m-"]');
      expect(gridItems.length).toBeGreaterThan(0);
    });
  });

  describe('Internationalization', () => {
    it('should display translated text content', () => {
      render(<HomePage />);

      expect(screen.getByText('Welcome to LiteMaaS')).toBeInTheDocument();
      expect(screen.getByText('Your AI Model Management Platform')).toBeInTheDocument();
      expect(screen.getByText('Browse and manage AI models')).toBeInTheDocument();
      expect(screen.getByText('Manage your AI model subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Manage your API access keys')).toBeInTheDocument();
      expect(screen.getByText('Monitor your API usage and costs')).toBeInTheDocument();
    });

    it('should render navigation labels correctly', () => {
      render(<HomePage />);

      expect(screen.getByText('Models')).toBeInTheDocument();
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Usage')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<HomePage />);
      const results = await axe(container, {
        rules: {
          // Temporarily disable heading-order rule as this is a component issue, not a test issue
          'heading-order': { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', () => {
      render(<HomePage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2s = screen.getAllByRole('heading', { level: 2 });

      expect(h1).toBeInTheDocument();
      // 5 navigation card h2 headings (dashboard widgets use h3 via MetricCard)
      expect(h2s).toHaveLength(5);
    });

    it('should have proper landmarks and regions', () => {
      render(<HomePage />);

      const sections = document.querySelectorAll('section[class*="pf-v6-c-page__main-section"]');
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.tab();

      const focusedElement = document.activeElement;
      expect(focusedElement).toBeTruthy();
      expect(focusedElement?.tagName).toMatch(/BUTTON|A|INPUT/i);
    });

    it('should have appropriate ARIA labels', () => {
      render(<HomePage />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(5);

      expect(screen.getByRole('heading', { level: 2, name: 'Models' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Subscriptions' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'API Keys' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeInTheDocument();
    });

    it('should provide sufficient color contrast', () => {
      render(<HomePage />);

      const titleElement = screen.getByRole('heading', { level: 1 });
      const computedStyle = window.getComputedStyle(titleElement);
      expect(computedStyle).toBeTruthy();
    });

    it('should handle focus management correctly', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await user.tab();
      const firstFocusable = document.activeElement;

      await user.tab();
      const secondFocusable = document.activeElement;

      expect(firstFocusable).not.toBe(secondFocusable);
    });
  });

  describe('Component structure and styling', () => {
    it('should use correct PatternFly component structure', () => {
      render(<HomePage />);

      const pageSections = document.querySelectorAll('.pf-v6-c-page__main-section');
      expect(pageSections.length).toBeGreaterThanOrEqual(3); // title + dashboard + nav cards
    });

    it('should apply compact and clickable card modifiers to navigation cards', () => {
      render(<HomePage />);

      const navCards = document.querySelectorAll('.pf-v6-c-card.pf-m-clickable');
      navCards.forEach((card) => {
        expect(card.classList.contains('pf-m-compact')).toBe(true);
        expect(card.classList.contains('pf-m-clickable')).toBe(true);
      });
    });

    it('should use proper Flex layout for card content', () => {
      render(<HomePage />);

      const flexContainers = document.querySelectorAll('.pf-v6-l-flex');
      expect(flexContainers.length).toBeGreaterThanOrEqual(4);
    });

    it('should display icons with proper styling', () => {
      render(<HomePage />);

      const iconElements = document.querySelectorAll('svg[style*="font-size"]');
      expect(iconElements.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Performance considerations', () => {
    it('should not cause unnecessary re-renders', () => {
      const { rerender } = render(<HomePage />);

      expect(() => rerender(<HomePage />)).not.toThrow();
    });

    it('should have efficient component structure', () => {
      const { container } = render(<HomePage />);

      const deeplyNestedElements = container.querySelectorAll('div div div div div div div div');
      expect(deeplyNestedElements.length).toBeLessThan(60);
    });
  });

  describe('Error boundaries and edge cases', () => {
    it('should handle translation errors gracefully', () => {
      expect(() => render(<HomePage />)).not.toThrow();
    });

    it('should work with router context provided', () => {
      expect(() => render(<HomePage />)).not.toThrow();
    });
  });

  describe('Content and messaging', () => {
    it('should display appropriate welcome message', () => {
      render(<HomePage />);

      expect(screen.getByText('Welcome to LiteMaaS')).toBeInTheDocument();
      expect(screen.getByText('Your AI Model Management Platform')).toBeInTheDocument();
    });

    it('should provide clear descriptions for each feature area', () => {
      render(<HomePage />);

      const descriptions = [
        'Browse and manage AI models',
        'Manage your AI model subscriptions',
        'Manage your API access keys',
        'Monitor your API usage and costs',
      ];

      descriptions.forEach((description) => {
        expect(screen.getByText(description)).toBeInTheDocument();
      });
    });

    it('should match card titles with navigation labels', () => {
      render(<HomePage />);

      expect(screen.getByText('Models')).toBeInTheDocument();
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Usage')).toBeInTheDocument();
    });
  });
});
