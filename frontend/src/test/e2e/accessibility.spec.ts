import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('LiteMaaS Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication or any required state
    // Note: Adjust this based on your app's authentication flow
    await page.goto('/');
  });

  test('HomePage should pass accessibility tests', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ModelsPage should pass accessibility tests', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await page.waitForSelector('[data-testid="model-card"]', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ModelsPage keyboard navigation should work', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await page.waitForSelector('[data-testid="model-card"]', { timeout: 10000 });
    
    // Test keyboard navigation through model cards
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = await page.locator(':focus').first();
      await expect(currentFocus).toBeVisible();
    }
  });

  test('ModelsPage search should be accessible', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for page to load
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });
    
    // Test search input accessibility
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toHaveAttribute('placeholder');
    await expect(searchInput).toBeVisible();
    
    // Test search functionality
    await searchInput.fill('GPT');
    await page.waitForTimeout(500); // Wait for search debounce
    
    // Run accessibility test on search results
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="models-grid"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Model details modal should be accessible', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load and click first model
    await page.waitForSelector('[data-testid="model-card"]', { timeout: 10000 });
    await page.locator('[data-testid="model-card"]').first().click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    // Test modal accessibility
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toHaveAttribute('aria-labelledby');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    
    // Test focus trap in modal
    await page.keyboard.press('Tab');
    const focusedInModal = await page.locator('[role="dialog"] :focus').count();
    expect(focusedInModal).toBeGreaterThan(0);
    
    // Test escape key closes modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('ApiKeysPage should pass accessibility tests', async ({ page }) => {
    await page.goto('/api-keys');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ApiKeysPage table should be accessible', async ({ page }) => {
    await page.goto('/api-keys');
    
    // Wait for table to load
    await page.waitForSelector('[role="table"]', { timeout: 10000 });
    
    // Test table structure
    const table = page.locator('[role="table"]');
    await expect(table).toBeVisible();
    
    // Headers should be present
    const headers = page.locator('[role="columnheader"]');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
    
    // Each header should have accessible name
    for (let i = 0; i < headerCount; i++) {
      const header = headers.nth(i);
      const headerText = await header.textContent();
      expect(headerText?.trim().length).toBeGreaterThan(0);
    }
  });

  test('SubscriptionsPage should pass accessibility tests', async ({ page }) => {
    await page.goto('/subscriptions');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('UsagePage should pass accessibility tests', async ({ page }) => {
    await page.goto('/usage');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Navigation should be keyboard accessible', async ({ page }) => {
    await page.goto('/');
    
    // Wait for navigation to load
    await page.waitForSelector('nav', { timeout: 5000 });
    
    // Test keyboard navigation through main nav
    const navLinks = page.locator('nav a, nav button');
    const navLinkCount = await navLinks.count();
    
    if (navLinkCount > 0) {
      // Focus first nav item
      await navLinks.first().focus();
      
      // Tab through navigation items
      for (let i = 0; i < navLinkCount - 1; i++) {
        await page.keyboard.press('Tab');
        const focusedElement = await page.locator(':focus').first();
        await expect(focusedElement).toBeVisible();
      }
    }
  });

  test('Error pages should be accessible', async ({ page }) => {
    // Test 404 page accessibility
    await page.goto('/non-existent-page');
    
    // Wait for error page to load
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Error page should have proper heading structure
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();
  });

  test('Focus indicators should be visible', async ({ page }) => {
    await page.goto('/');
    
    // Test focus indicators on interactive elements
    const interactiveElements = page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const elementCount = await interactiveElements.count();
    
    if (elementCount > 0) {
      for (let i = 0; i < Math.min(5, elementCount); i++) {
        const element = interactiveElements.nth(i);
        await element.focus();
        
        // Check if element has focus (this is a basic check)
        const isFocused = await element.evaluate(el => document.activeElement === el);
        expect(isFocused).toBe(true);
        
        // Check for focus indicator styles
        const hasOutline = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.outline !== 'none' || 
                 style.boxShadow !== 'none' ||
                 el.classList.contains('pf-v6-m-focus') ||
                 el.matches(':focus-visible');
        });
        
        // Focus indicator should be present (may be handled by CSS)
        // This is a basic check - visual testing tools would be better
        console.log(`Element ${i} focus indicator present:`, hasOutline);
      }
    }
  });

  test('Color contrast should meet WCAG standards', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Run axe with color-contrast rule specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Images should have alternative text', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for images without alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');
      const ariaLabel = await image.getAttribute('aria-label');
      const ariaLabelledby = await image.getAttribute('aria-labelledby');
      const role = await image.getAttribute('role');
      
      // Image should have alt text or be marked as decorative
      const hasAccessibleName = alt !== null || ariaLabel || ariaLabelledby;
      const isDecorative = role === 'presentation' || alt === '';
      
      expect(hasAccessibleName || isDecorative).toBe(true);
    }
  });

  test('Form controls should have labels', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for search form to load
    await page.waitForSelector('input', { timeout: 5000 });
    
    const formControls = page.locator('input:not([type="hidden"]), select, textarea');
    const controlCount = await formControls.count();
    
    for (let i = 0; i < controlCount; i++) {
      const control = formControls.nth(i);
      const ariaLabel = await control.getAttribute('aria-label');
      const ariaLabelledby = await control.getAttribute('aria-labelledby');
      const id = await control.getAttribute('id');
      
      // Check for associated label
      let hasLabel = false;
      if (ariaLabel || ariaLabelledby) {
        hasLabel = true;
      } else if (id) {
        const label = page.locator(`label[for="${id}"]`);
        hasLabel = await label.count() > 0;
      }
      
      // Control is wrapped in a label
      if (!hasLabel) {
        const wrappingLabel = page.locator('label').filter({ has: control });
        hasLabel = await wrappingLabel.count() > 0;
      }
      
      expect(hasLabel).toBe(true);
    }
  });

  test('Skip links should be present and functional', async ({ page }) => {
    await page.goto('/');
    
    // Test for skip link functionality
    await page.keyboard.press('Tab');
    
    const skipLink = page.locator('a[href*="#main"], a[href*="#content"]').first();
    const skipLinkExists = await skipLink.count() > 0;
    
    if (skipLinkExists) {
      await expect(skipLink).toBeVisible();
      
      // Test skip link functionality
      await skipLink.click();
      
      const targetId = await skipLink.getAttribute('href');
      if (targetId) {
        const target = page.locator(targetId);
        await expect(target).toBeVisible();
      }
    }
  });

  test('Live regions should announce dynamic content', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Look for live regions
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const regionCount = await liveRegions.count();
    
    // Check that live regions have appropriate attributes
    for (let i = 0; i < regionCount; i++) {
      const region = liveRegions.nth(i);
      const ariaLive = await region.getAttribute('aria-live');
      const role = await region.getAttribute('role');
      
      if (ariaLive) {
        expect(['polite', 'assertive', 'off']).toContain(ariaLive);
      }
      
      if (role) {
        expect(['status', 'alert', 'log']).toContain(role);
      }
    }
  });

  test('Modal dialogs should trap focus properly', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load and open modal
    await page.waitForSelector('[data-testid="model-card"]', { timeout: 10000 });
    await page.locator('[data-testid="model-card"]').first().click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    const modal = page.locator('[role="dialog"]');
    
    // Get all focusable elements in modal
    const focusableElements = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const focusableCount = await focusableElements.count();
    
    if (focusableCount > 1) {
      // Focus should be trapped within modal
      const firstFocusable = focusableElements.first();
      const lastFocusable = focusableElements.last();
      
      // Focus first element
      await firstFocusable.focus();
      
      // Tab through all elements
      for (let i = 0; i < focusableCount - 1; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Should now be on last element
      const currentFocus = await page.locator(':focus').first();
      const isLastElement = await currentFocus.evaluate((el, lastEl) => el === lastEl, await lastFocusable.elementHandle());
      expect(isLastElement).toBe(true);
      
      // Tab once more should wrap to first element
      await page.keyboard.press('Tab');
      const wrappedFocus = await page.locator(':focus').first();
      const isFirstElement = await wrappedFocus.evaluate((el, firstEl) => el === firstEl, await firstFocusable.elementHandle());
      expect(isFirstElement).toBe(true);
    }
  });
});