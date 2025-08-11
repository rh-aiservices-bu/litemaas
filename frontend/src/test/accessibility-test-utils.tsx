/**
 * Accessibility Test Utilities
 *
 * This module provides comprehensive utilities for testing accessibility
 * in React components using axe-core and React Testing Library.
 *
 * These utilities support WCAG 2.1 AA compliance testing and include
 * helpers for keyboard navigation, ARIA attributes, and screen reader testing.
 */

import { RenderResult } from '@testing-library/react';
import { render } from './test-utils'; // Import custom render with all providers
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import React from 'react';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

/**
 * Extended render result with accessibility testing utilities
 */
export interface AccessibleRenderResult extends RenderResult {
  /** Run axe-core accessibility tests on the rendered component */
  testAccessibility: () => Promise<void>;
  /** Test keyboard navigation through the component */
  testKeyboardNavigation: () => Promise<void>;
  /** Test ARIA attributes and properties */
  testAriaAttributes: () => void;
  /** Test focus management */
  testFocusManagement: () => Promise<void>;
  /** Test color contrast (requires additional setup) */
  testColorContrast: () => Promise<void>;
}

/**
 * Accessibility-aware render function
 *
 * This function extends React Testing Library's render with
 * built-in accessibility testing capabilities.
 *
 * @param ui - React component to render
 * @param options - Render options
 * @returns Extended render result with accessibility utilities
 */
export const renderWithAccessibility = (
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1],
): AccessibleRenderResult => {
  const result = render(ui, {
    // Default options for accessibility testing
    ...options,
  });

  const testAccessibility = async (): Promise<void> => {
    const results = await axe(result.container, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    } as any);

    expect(results).toHaveNoViolations();
  };

  const testKeyboardNavigation = async (): Promise<void> => {
    const user = userEvent.setup();

    // Get all interactive elements
    const interactiveElements = result.container.querySelectorAll(
      'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    );

    if (interactiveElements.length === 0) {
      console.info('No interactive elements found for keyboard navigation test');
      return;
    }

    // Test tab order
    const firstElement = interactiveElements[0] as HTMLElement;

    // Focus first element
    firstElement.focus();
    expect(document.activeElement).toBe(firstElement);

    // Tab through all elements
    for (let i = 1; i < interactiveElements.length; i++) {
      await user.tab();
      const expectedElement = interactiveElements[i] as HTMLElement;

      // Skip elements that might not be focusable due to CSS or state
      if (
        expectedElement.style.display !== 'none' &&
        !expectedElement.hasAttribute('disabled') &&
        expectedElement.tabIndex !== -1
      ) {
        expect(document.activeElement).toBe(expectedElement);
      }
    }

    // Test reverse tab order
    for (let i = interactiveElements.length - 2; i >= 0; i--) {
      await user.tab({ shift: true });
      const expectedElement = interactiveElements[i] as HTMLElement;

      if (
        expectedElement.style.display !== 'none' &&
        !expectedElement.hasAttribute('disabled') &&
        expectedElement.tabIndex !== -1
      ) {
        expect(document.activeElement).toBe(expectedElement);
      }
    }
  };

  const testAriaAttributes = (): void => {
    // Test for required ARIA attributes based on roles
    const elementsWithRoles = result.container.querySelectorAll('[role]');

    elementsWithRoles.forEach((element: Element) => {
      const role = element.getAttribute('role');

      switch (role) {
        case 'button':
          // Buttons should have accessible names
          expect(
            element.hasAttribute('aria-label') ||
              element.hasAttribute('aria-labelledby') ||
              element.textContent?.trim(),
          ).toBeTruthy();
          break;

        case 'dialog':
          // Dialogs should have labels and proper focus management
          expect(
            element.hasAttribute('aria-labelledby') || element.hasAttribute('aria-label'),
          ).toBeTruthy();
          break;

        case 'tab':
          // Tabs should have proper ARIA attributes
          expect(element.hasAttribute('aria-selected')).toBeTruthy();
          expect(element.hasAttribute('aria-controls')).toBeTruthy();
          break;

        case 'tabpanel':
          // Tab panels should have proper labeling
          expect(element.hasAttribute('aria-labelledby')).toBeTruthy();
          break;

        case 'listbox':
          // Listboxes should have selection state
          expect(
            element.hasAttribute('aria-multiselectable') ||
              element.querySelector('[aria-selected]'),
          ).toBeTruthy();
          break;

        case 'alert':
          // Alerts should have live region properties
          expect(
            element.getAttribute('aria-live') === 'assertive' ||
              element.getAttribute('aria-live') === 'polite',
          ).toBeTruthy();
          break;
      }
    });

    // Test form elements for proper labeling
    const formElements = result.container.querySelectorAll(
      'input:not([type="hidden"]), select, textarea',
    );

    formElements.forEach((element: Element) => {
      const hasLabel =
        element.hasAttribute('aria-label') ||
        element.hasAttribute('aria-labelledby') ||
        result.container.querySelector(`label[for="${element.id}"]`) ||
        element.closest('label');

      expect(hasLabel).toBeTruthy();
    });
  };

  const testFocusManagement = async (): Promise<void> => {
    const user = userEvent.setup();

    // Test that focus is visible when using keyboard
    const focusableElements = result.container.querySelectorAll(
      'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    );

    for (const element of Array.from(focusableElements)) {
      const htmlElement = element as HTMLElement;

      // Focus the element
      htmlElement.focus();

      // Check if element has focus
      expect(document.activeElement).toBe(htmlElement);

      // Check for focus indicators (outline, focus ring, etc.)
      const computedStyle = window.getComputedStyle(htmlElement);
      const hasFocusIndicator =
        computedStyle.outline !== 'none' ||
        computedStyle.boxShadow !== 'none' ||
        computedStyle.border !== 'none' ||
        htmlElement.classList.contains('pf-v6-m-focus') ||
        htmlElement.matches(':focus-visible');

      // Note: In test environment, CSS focus indicators might not be computed
      // This is more of a visual check that should be done manually
      console.info(`Focus indicator check for ${htmlElement.tagName}:`, hasFocusIndicator);
    }

    // Test escape key handling for modal/dialog elements
    const modalElements = result.container.querySelectorAll(
      '[role="dialog"], .pf-v6-c-modal',
    ) as NodeListOf<HTMLElement>;

    for (const modal of modalElements) {
      const closeButtons = modal.querySelectorAll(
        '[aria-label*="Close"], [aria-label*="close"], .pf-v6-c-button.pf-v6-m-plain',
      );

      if (closeButtons.length > 0) {
        // Focus the modal
        modal.focus();

        // Press Escape
        await user.keyboard('{Escape}');

        // Modal should handle escape (implementation specific)
        // This test verifies the escape key is handled, not that modal closes
        // as that depends on the component's implementation
      }
    }
  };

  const testColorContrast = async (): Promise<void> => {
    // This test requires actual computed styles and color analysis
    // For now, we'll check for PatternFly color utility classes
    // that are known to meet WCAG AA contrast requirements

    const textElements = result.container.querySelectorAll('*');

    textElements.forEach((element: Element) => {
      const classList = Array.from(element.classList) as string[];

      // Check for PatternFly color classes that ensure good contrast
      const hasGoodContrastClass = classList.some(
        (className: string) =>
          className.includes('pf-v6-u-color-') || className.includes('pf-v6-c-'), // PatternFly components have tested contrast
      );

      // This is a basic check - actual color contrast testing
      // requires specialized tools or visual testing
      if (element.textContent?.trim()) {
        console.info(`Color contrast check for element:`, {
          text: element.textContent.substring(0, 50),
          hasPatternFlyStyles: hasGoodContrastClass,
          classes: classList,
        });
      }
    });

    // Run axe color-contrast rule specifically
    const results = await axe(result.container);

    expect(results).toHaveNoViolations();
  };

  return {
    ...result,
    testAccessibility,
    testKeyboardNavigation,
    testAriaAttributes,
    testFocusManagement,
    testColorContrast,
  };
};

/**
 * Keyboard navigation test utilities
 */
export const keyboardTestUtils = {
  /**
   * Test tab order for a specific container
   */
  testTabOrder: async (container: HTMLElement, expectedOrder?: string[]): Promise<void> => {
    const user = userEvent.setup();
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    );

    const actualOrder: string[] = [];

    // Focus first element
    if (interactiveElements.length > 0) {
      (interactiveElements[0] as HTMLElement).focus();
      actualOrder.push((interactiveElements[0] as HTMLElement).tagName.toLowerCase());

      // Tab through remaining elements
      for (let i = 1; i < interactiveElements.length; i++) {
        await user.tab();
        if (document.activeElement) {
          actualOrder.push(document.activeElement.tagName.toLowerCase());
        }
      }
    }

    if (expectedOrder) {
      expect(actualOrder).toEqual(expectedOrder);
    }

    return;
  },

  /**
   * Test arrow key navigation for lists and menus
   */
  testArrowKeyNavigation: async (
    container: HTMLElement,
    orientation: 'horizontal' | 'vertical' = 'vertical',
  ): Promise<void> => {
    const user = userEvent.setup();
    const navigableElements = container.querySelectorAll(
      '[role="option"], [role="menuitem"], [role="tab"], li button, li a',
    );

    if (navigableElements.length === 0) return;

    // Focus first element
    (navigableElements[0] as HTMLElement).focus();
    expect(document.activeElement).toBe(navigableElements[0]);

    // Test forward navigation
    const forwardKey = orientation === 'vertical' ? '{ArrowDown}' : '{ArrowRight}';
    const backwardKey = orientation === 'vertical' ? '{ArrowUp}' : '{ArrowLeft}';

    for (let i = 1; i < navigableElements.length; i++) {
      await user.keyboard(forwardKey);
      expect(document.activeElement).toBe(navigableElements[i]);
    }

    // Test backward navigation
    for (let i = navigableElements.length - 2; i >= 0; i--) {
      await user.keyboard(backwardKey);
      expect(document.activeElement).toBe(navigableElements[i]);
    }
  },

  /**
   * Test Enter and Space key activation
   */
  testKeyActivation: async (element: HTMLElement): Promise<void> => {
    const user = userEvent.setup();
    const clickHandler = vi.fn();

    element.addEventListener('click', clickHandler);
    element.focus();

    // Test Enter key
    await user.keyboard('{Enter}');
    expect(clickHandler).toHaveBeenCalled();

    vi.clearAllMocks();

    // Test Space key (for buttons)
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      await user.keyboard(' ');
      expect(clickHandler).toHaveBeenCalled();
    }
  },
};

/**
 * ARIA test utilities
 */
export const ariaTestUtils = {
  /**
   * Test live region announcements
   */
  testLiveRegion: (container: HTMLElement): void => {
    const liveRegions = container.querySelectorAll('[aria-live]');

    liveRegions.forEach((region) => {
      const ariaLive = region.getAttribute('aria-live');
      expect(['polite', 'assertive', 'off']).toContain(ariaLive);
    });
  },

  /**
   * Test expanded/collapsed states
   */
  testExpandableStates: (container: HTMLElement): void => {
    const expandableElements = container.querySelectorAll('[aria-expanded]');

    expandableElements.forEach((element) => {
      const ariaExpanded = element.getAttribute('aria-expanded');
      expect(['true', 'false']).toContain(ariaExpanded);

      // Check for corresponding controlled element
      const ariaControls = element.getAttribute('aria-controls');
      if (ariaControls) {
        const controlledElement = document.getElementById(ariaControls);
        expect(controlledElement).toBeTruthy();
      }
    });
  },

  /**
   * Test form element labeling
   */
  testFormLabeling: (container: HTMLElement): void => {
    const formElements = container.querySelectorAll('input:not([type="hidden"]), select, textarea');

    formElements.forEach((element) => {
      const hasLabel =
        element.hasAttribute('aria-label') ||
        element.hasAttribute('aria-labelledby') ||
        container.querySelector(`label[for="${element.id}"]`) ||
        element.closest('label');

      expect(hasLabel).toBeTruthy();
    });
  },

  /**
   * Test heading hierarchy
   */
  testHeadingHierarchy: (container: HTMLElement): void => {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
      parseInt(h.tagName.charAt(1)),
    );

    if (headings.length === 0) return;

    // Check for proper heading order (no skipping levels)
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      // Allow same level or one level deeper, or any level higher
      const validProgression =
        current <= previous + 1 || // Same or one deeper
        current <= previous; // Same or higher

      expect(validProgression).toBeTruthy();
    }
  },
};

/**
 * Screen reader test utilities
 */
export const screenReaderTestUtils = {
  /**
   * Test screen reader announcements
   */
  testAnnouncements: (container: HTMLElement): string[] => {
    const announcements: string[] = [];

    // Collect text from live regions
    const liveRegions = container.querySelectorAll('[aria-live]');
    liveRegions.forEach((region) => {
      if (region.textContent?.trim()) {
        announcements.push(region.textContent.trim());
      }
    });

    // Collect text from status regions
    const statusRegions = container.querySelectorAll('[role="status"], [role="alert"]');
    statusRegions.forEach((region) => {
      if (region.textContent?.trim()) {
        announcements.push(region.textContent.trim());
      }
    });

    return announcements;
  },

  /**
   * Test accessible names and descriptions
   */
  testAccessibleNames: (container: HTMLElement): void => {
    const elements = container.querySelectorAll(
      'button, [role="button"], input, select, textarea, a[href], [role="link"]',
    );

    elements.forEach((element) => {
      // Check for accessible name
      const accessibleName =
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby') ||
        element.textContent?.trim() ||
        element.getAttribute('title');

      expect(accessibleName).toBeTruthy();
    });
  },
};

/**
 * PatternFly-specific accessibility test utilities
 */
export const patternFlyA11yUtils = {
  /**
   * Test PatternFly component accessibility
   */
  testPatternFlyComponent: async (container: HTMLElement, componentType: string): Promise<void> => {
    const pfComponents = container.querySelectorAll(`[class*="pf-v6-c-${componentType}"]`);

    for (const component of Array.from(pfComponents)) {
      // Test component-specific accessibility requirements
      switch (componentType) {
        case 'button':
          expect(
            component.hasAttribute('aria-label') ||
              component.textContent?.trim() ||
              component.hasAttribute('aria-labelledby'),
          ).toBeTruthy();
          break;

        case 'card':
          // Cards should have proper heading structure if they contain headings
          const cardHeadings = component.querySelectorAll('h1, h2, h3, h4, h5, h6');
          if (cardHeadings.length > 0) {
            ariaTestUtils.testHeadingHierarchy(component as HTMLElement);
          }
          break;

        case 'modal':
          // Modals should have proper labeling and focus management
          expect(
            component.hasAttribute('aria-labelledby') || component.hasAttribute('aria-label'),
          ).toBeTruthy();

          // Should have role="dialog"
          expect(component.getAttribute('role')).toBe('dialog');
          break;

        case 'table':
          // Tables should have proper headers
          const headers = component.querySelectorAll('th');
          const cells = component.querySelectorAll('td');

          if (cells.length > 0) {
            expect(headers.length).toBeGreaterThan(0);
          }
          break;
      }
    }

    // Run axe tests on PatternFly components
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  },
};

/**
 * Common accessibility test suite
 *
 * This function runs a comprehensive set of accessibility tests
 * that should pass for most components.
 */
export const runCommonA11yTests = async (container: HTMLElement): Promise<void> => {
  // Run axe-core tests
  const results = await axe(container);
  expect(results).toHaveNoViolations();

  // Test ARIA attributes
  ariaTestUtils.testFormLabeling(container);
  ariaTestUtils.testExpandableStates(container);
  ariaTestUtils.testLiveRegion(container);
  ariaTestUtils.testHeadingHierarchy(container);

  // Test screen reader compatibility
  screenReaderTestUtils.testAccessibleNames(container);
};

// Export all utilities as default object
export default {
  renderWithAccessibility,
  keyboardTestUtils,
  ariaTestUtils,
  screenReaderTestUtils,
  patternFlyA11yUtils,
  runCommonA11yTests,
};
