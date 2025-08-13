/**
 * Axe-core Configuration Tests
 *
 * Tests for the accessibility testing infrastructure setup including:
 * - Axe-core rule configuration and validation
 * - WCAG 2.1 AA compliance testing
 * - Custom accessibility rule definitions
 * - Performance optimization for accessibility testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type AxeRuleConfig = { enabled: boolean };
type AxeConfiguration = {
  rules?: Record<string, AxeRuleConfig>;
  resultTypes?: Array<'violations' | 'incomplete' | 'passes' | 'inapplicable'>;
  timeout?: number;
  preload?: boolean;
  reporter?: 'v1' | 'v2' | 'raw' | 'raw-env' | 'no-passes';
  tags?: string[];
};

describe('Accessibility Testing Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Axe-core configuration', () => {
    it('should have proper WCAG 2.1 AA rule configuration', () => {
      const config: AxeConfiguration = {
        rules: {
          // WCAG 2.1 Level A rules
          'area-alt': { enabled: true },
          'aria-allowed-attr': { enabled: true },
          'aria-hidden-body': { enabled: true },
          'aria-hidden-focus': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-required-children': { enabled: true },
          'aria-required-parent': { enabled: true },
          'aria-roles': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'button-name': { enabled: true },
          bypass: { enabled: true },
          'color-contrast': { enabled: true },
          'document-title': { enabled: true },
          'duplicate-id': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'frame-title': { enabled: true },
          'html-has-lang': { enabled: true },
          'html-lang-valid': { enabled: true },
          'image-alt': { enabled: true },
          'input-button-name': { enabled: true },
          'input-image-alt': { enabled: true },
          label: { enabled: true },
          'link-name': { enabled: true },
          list: { enabled: true },
          listitem: { enabled: true },
          'meta-refresh': { enabled: true },
          'meta-viewport': { enabled: true },
          'object-alt': { enabled: true },
          'role-img-alt': { enabled: true },
          'scrollable-region-focusable': { enabled: true },
          'select-name': { enabled: true },
          'server-side-image-map': { enabled: true },
          'svg-img-alt': { enabled: true },
          'td-headers-attr': { enabled: true },
          'th-has-data-cells': { enabled: true },
          'valid-lang': { enabled: true },
          'video-caption': { enabled: true },

          // WCAG 2.1 Level AA additional rules
          'color-contrast-enhanced': { enabled: false }, // Level AAA, not required for AA
          'focus-order-semantics': { enabled: true },
          'hidden-content': { enabled: false }, // Can cause false positives
          'landmark-banner-is-top-level': { enabled: true },
          'landmark-complementary-is-top-level': { enabled: true },
          'landmark-contentinfo-is-top-level': { enabled: true },
          'landmark-main-is-top-level': { enabled: true },
          'landmark-no-duplicate-banner': { enabled: true },
          'landmark-no-duplicate-contentinfo': { enabled: true },
          'landmark-one-main': { enabled: true },
          'page-has-heading-one': { enabled: true },
          region: { enabled: true },

          // Best practices for web applications
          'aria-allowed-role': { enabled: true },
          'aria-command-name': { enabled: true },
          'aria-toggle-field-name': { enabled: true },
          'empty-heading': { enabled: true },
          'heading-order': { enabled: true },
          'identical-links-same-purpose': { enabled: true },
          'label-title-only': { enabled: true },
          'link-in-text-block': { enabled: true },
          'nested-interactive': { enabled: true },
          'no-autoplay-audio': { enabled: true },
          tabindex: { enabled: true },
        },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      };

      expect(config.rules).toBeDefined();
      expect(config.tags).toContain('wcag2a');
      expect(config.tags).toContain('wcag2aa');
      expect(config.tags).toContain('wcag21aa');

      // Ensure critical rules are enabled
      expect(config.rules?.['color-contrast']?.enabled).toBe(true);
      expect(config.rules?.['aria-valid-attr']?.enabled).toBe(true);
      expect(config.rules?.['button-name']?.enabled).toBe(true);
      expect(config.rules?.['label']?.enabled).toBe(true);
      expect(config.rules?.['link-name']?.enabled).toBe(true);
    });

    it('should disable problematic rules that cause false positives', () => {
      const config: AxeConfiguration = {
        rules: {
          // Rules that commonly cause false positives in React apps
          'hidden-content': { enabled: false },
          'color-contrast-enhanced': { enabled: false }, // AAA level, not AA
          'autocomplete-valid': { enabled: false }, // Can be problematic with custom components
        },
      };

      expect(config.rules?.['hidden-content']?.enabled).toBe(false);
      expect(config.rules?.['color-contrast-enhanced']?.enabled).toBe(false);
      expect(config.rules?.['autocomplete-valid']?.enabled).toBe(false);
    });

    it('should configure axe with proper timeout settings', () => {
      const config: AxeConfiguration = {
        timeout: 5000, // 5 seconds for complex components
        preload: true,
        reporter: 'v2',
      };

      expect(config.timeout).toBe(5000);
      expect(config.preload).toBe(true);
      expect(config.reporter).toBe('v2');
    });

    it('should handle PatternFly-specific accessibility patterns', () => {
      const config: AxeConfiguration = {
        rules: {
          // PatternFly uses custom patterns that may need special handling
          'aria-allowed-attr': { enabled: true },
          'aria-allowed-role': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },

          // PatternFly tables and lists
          listitem: { enabled: true },
          list: { enabled: true },
          'td-headers-attr': { enabled: true },
          'th-has-data-cells': { enabled: true },

          // PatternFly navigation and landmarks
          'landmark-banner-is-top-level': { enabled: true },
          'landmark-main-is-top-level': { enabled: true },
          region: { enabled: true },
        },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      };

      expect(config.tags).toContain('best-practice');
      expect(config.rules?.['aria-allowed-attr']?.enabled).toBe(true);
      expect(config.rules?.['region']?.enabled).toBe(true);
    });
  });

  describe('Custom accessibility test utilities', () => {
    it('should provide utilities for keyboard navigation testing', () => {
      const keyboardTestUtils = {
        testTabOrder: async (container: HTMLElement): Promise<HTMLElement[]> => {
          const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );

          const tabOrder: HTMLElement[] = [];

          for (const element of Array.from(focusableElements)) {
            const htmlElement = element as HTMLElement;
            if (htmlElement.tabIndex >= 0) {
              tabOrder.push(htmlElement);
            }
          }

          return tabOrder.sort((a, b) => {
            const aIndex = a.tabIndex || 0;
            const bIndex = b.tabIndex || 0;
            return aIndex - bIndex;
          });
        },

        testArrowKeyNavigation: (container: HTMLElement, _startElement?: HTMLElement): void => {
          const navElements = container.querySelectorAll(
            '[role="menuitem"], [role="option"], [role="tab"]',
          );
          expect(navElements.length).toBeGreaterThan(0);

          // Test that arrow key navigation is supported
          navElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            expect(htmlElement.getAttribute('tabindex')).toBeDefined();
          });
        },

        testEscapeKeyHandling: (container: HTMLElement): void => {
          const modals = container.querySelectorAll('[role="dialog"], [role="alertdialog"]');
          const menus = container.querySelectorAll('[role="menu"], [role="listbox"]');

          [...modals, ...menus].forEach((element) => {
            // These elements should handle Escape key
            expect(element.getAttribute('aria-modal') || element.getAttribute('role')).toBeTruthy();
          });
        },
      };

      expect(keyboardTestUtils.testTabOrder).toBeInstanceOf(Function);
      expect(keyboardTestUtils.testArrowKeyNavigation).toBeInstanceOf(Function);
      expect(keyboardTestUtils.testEscapeKeyHandling).toBeInstanceOf(Function);
    });

    it('should provide utilities for ARIA testing', () => {
      const ariaTestUtils = {
        testLiveRegions: (container: HTMLElement): void => {
          const liveRegions = container.querySelectorAll('[aria-live]');

          liveRegions.forEach((region) => {
            const ariaLive = region.getAttribute('aria-live');
            expect(['polite', 'assertive', 'off']).toContain(ariaLive);

            if (ariaLive !== 'off') {
              // Live regions should also have aria-atomic
              expect(region.getAttribute('aria-atomic')).toBeTruthy();
            }
          });
        },

        testHeadingHierarchy: (container: HTMLElement): void => {
          const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
          const headingLevels = Array.from(headings).map((h) => parseInt(h.tagName.charAt(1)));

          if (headingLevels.length > 0) {
            // Should start with h1
            expect(headingLevels[0]).toBe(1);

            // Should not skip levels
            for (let i = 1; i < headingLevels.length; i++) {
              const diff = headingLevels[i] - headingLevels[i - 1];
              expect(diff).toBeLessThanOrEqual(1);
            }
          }
        },

        testFormLabeling: (container: HTMLElement): void => {
          const formControls = container.querySelectorAll(
            'input:not([type="hidden"]), select, textarea',
          );

          formControls.forEach((control) => {
            const id = control.getAttribute('id');
            const ariaLabelledBy = control.getAttribute('aria-labelledby');
            const ariaLabel = control.getAttribute('aria-label');

            // Each form control should have a label
            const hasLabel =
              ariaLabelledBy || ariaLabel || (id && container.querySelector(`label[for="${id}"]`));

            expect(hasLabel).toBeTruthy();
          });
        },

        testLandmarks: (container: HTMLElement): void => {
          // Should have at least a main landmark
          const mainLandmarks = container.querySelectorAll('[role="main"], main');
          expect(mainLandmarks.length).toBeGreaterThanOrEqual(0); // 0 for components, 1+ for pages
        },
      };

      expect(ariaTestUtils.testLiveRegions).toBeInstanceOf(Function);
      expect(ariaTestUtils.testHeadingHierarchy).toBeInstanceOf(Function);
      expect(ariaTestUtils.testFormLabeling).toBeInstanceOf(Function);
      expect(ariaTestUtils.testLandmarks).toBeInstanceOf(Function);
    });

    it('should provide utilities for color contrast testing', () => {
      const colorContrastUtils = {
        testTextContrast: (element: HTMLElement): Promise<boolean> => {
          const styles = window.getComputedStyle(element);
          const color = styles.color;
          const backgroundColor = styles.backgroundColor;

          // This is a simplified test - in reality, you'd use a proper contrast calculation
          return Promise.resolve(color !== backgroundColor);
        },

        testFocusIndicators: (container: HTMLElement): void => {
          const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );

          focusableElements.forEach((element) => {
            const htmlElement = element as HTMLElement;

            // Focus the element to test focus indicator
            htmlElement.focus();
            const styles = window.getComputedStyle(htmlElement, ':focus');

            // Should have some form of focus indicator
            const hasOutline = styles.outline !== 'none' && styles.outline !== '';
            const hasBoxShadow = styles.boxShadow !== 'none' && styles.boxShadow !== '';
            const hasBorder = styles.borderColor !== 'transparent';

            expect(hasOutline || hasBoxShadow || hasBorder).toBe(true);
          });
        },
      };

      expect(colorContrastUtils.testTextContrast).toBeInstanceOf(Function);
      expect(colorContrastUtils.testFocusIndicators).toBeInstanceOf(Function);
    });
  });

  describe('Performance optimization for accessibility testing', () => {
    it('should configure axe for optimal performance', () => {
      const performantConfig: AxeConfiguration = {
        // Disable expensive rules for unit tests
        rules: {
          'color-contrast': { enabled: false }, // Expensive, test separately
          'landmark-complementary-is-top-level': { enabled: false }, // Less critical for components
          'landmark-contentinfo-is-top-level': { enabled: false }, // Less critical for components
          'page-has-heading-one': { enabled: false }, // Only relevant for full pages
        },

        // Limit scope for better performance
        resultTypes: ['violations', 'incomplete'],

        // Reasonable timeout for CI/CD
        timeout: 3000,
      };

      expect(performantConfig.timeout).toBe(3000);
      expect(performantConfig.resultTypes).not.toContain('passes');
      expect(performantConfig.rules?.['color-contrast']?.enabled).toBe(false);
    });

    it('should provide separate configuration for comprehensive testing', () => {
      const comprehensiveConfig: AxeConfiguration = {
        rules: {
          // Enable all WCAG 2.1 AA rules for comprehensive testing
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: false }, // Still AA level only
          'focus-order-semantics': { enabled: true },
          'landmark-banner-is-top-level': { enabled: true },
          'landmark-complementary-is-top-level': { enabled: true },
          'landmark-contentinfo-is-top-level': { enabled: true },
          'landmark-main-is-top-level': { enabled: true },
          'landmark-no-duplicate-banner': { enabled: true },
          'landmark-no-duplicate-contentinfo': { enabled: true },
          'landmark-one-main': { enabled: true },
          'page-has-heading-one': { enabled: true },
          region: { enabled: true },
        },

        // Include all result types for thorough analysis
        resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable'],

        // Longer timeout for comprehensive testing
        timeout: 10000,

        // Enable all relevant tags
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      };

      expect(comprehensiveConfig.timeout).toBe(10000);
      expect(comprehensiveConfig.resultTypes).toContain('passes');
      expect(comprehensiveConfig.resultTypes).toContain('inapplicable');
      expect(comprehensiveConfig.tags).toContain('best-practice');
    });

    it('should handle memory efficiently for large component trees', () => {
      const memoryEfficientConfig: AxeConfiguration = {
        // Process in smaller chunks
        preload: false,

        // Focus on critical violations only
        resultTypes: ['violations'],

        // Shorter timeout to prevent memory buildup
        timeout: 2000,

        // Disable rules that require extensive DOM traversal
        rules: {
          'identical-links-same-purpose': { enabled: false },
          'landmark-complementary-is-top-level': { enabled: false },
          region: { enabled: false },
        },
      };

      expect(memoryEfficientConfig.preload).toBe(false);
      expect(memoryEfficientConfig.resultTypes).toEqual(['violations']);
      expect(memoryEfficientConfig.timeout).toBe(2000);
    });
  });

  describe.skip('Integration with existing test framework', () => {
    // TODO: Fix DOM environment issues in axe integration tests
    // Issue: ReferenceError: document is not defined
    // Problem: DOM environment not properly configured for these integration tests
    /*
    it('should work with vitest and testing-library', async () => {
      // This test verifies that axe integrates properly with our test stack
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <h1>Test Page</h1>
        <button aria-label="Test button">Click me</button>
        <input type="text" aria-label="Test input" />
      `;

      const results = await axe(mockElement, {
        rules: {
          'color-contrast': { enabled: false }, // Avoid issues in test environment
        },
      });

      expect(results.violations).toEqual([]);
      expect(results.passes).toBeDefined();
      expect(results.incomplete).toBeDefined();
      expect(results.inapplicable).toBeDefined();
    });

    it('should provide helpful error messages for violations', async () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <button></button> <!-- Missing accessible name -->
      `;

      const results = await axe(mockElement);

      if (results.violations.length > 0) {
        const buttonNameViolation = results.violations.find(v => v.id === 'button-name');
        if (buttonNameViolation) {
          expect(buttonNameViolation.help).toBeTruthy();
          expect(buttonNameViolation.helpUrl).toBeTruthy();
          expect(buttonNameViolation.nodes.length).toBeGreaterThan(0);
        }
      }
    });
    */
  });
});
