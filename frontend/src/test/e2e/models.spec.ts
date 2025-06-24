import { test, expect } from '@playwright/test';

test.describe('Models Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for E2E tests
    await page.goto('/login');
    await page.getByText('Login as Admin (Test)').click();
    await expect(page).toHaveURL('/');
  });

  test('should display models page with model listings', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for page to load
    await expect(page.getByText('Model Discovery')).toBeVisible();
    
    // Should show models after loading
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Claude 3 Opus')).toBeVisible();
    
    // Should show model details
    await expect(page.getByText('by OpenAI')).toBeVisible();
    await expect(page.getByText('Available')).toBeVisible();
  });

  test('should filter models by search term', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Search for specific model
    await page.getByPlaceholder('Search models...').fill('GPT');
    
    // Should show filtered results
    await expect(page.getByText('GPT-4')).toBeVisible();
    
    // Clear search and verify all models show again
    await page.getByPlaceholder('Search models...').clear();
    await expect(page.getByText('Claude 3 Opus')).toBeVisible();
  });

  test('should open model details modal', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Click on model card
    await page.getByText('GPT-4').first().click();
    
    // Should open modal with details
    await expect(page.getByText('Subscribe to Model')).toBeVisible();
    await expect(page.getByText('Context Length')).toBeVisible();
    await expect(page.getByText('Pricing')).toBeVisible();
    
    // Close modal
    await page.getByText('Close').click();
    await expect(page.getByText('Subscribe to Model')).not.toBeVisible();
  });

  test('should handle model subscription flow', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load and click model
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    await page.getByText('GPT-4').first().click();
    
    // Subscribe to model
    await expect(page.getByText('Subscribe to Model')).toBeVisible();
    await page.getByText('Subscribe to Model').click();
    
    // Should show notification
    await expect(page.getByText('Subscription Request')).toBeVisible({ timeout: 5000 });
  });

  test('should filter models by provider', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Open provider filter
    await page.getByText('All Providers').click();
    
    // Select OpenAI
    await page.getByText('OpenAI').click();
    
    // Should filter to OpenAI models only
    await expect(page.getByText('GPT-4')).toBeVisible();
    // Anthropic models should be hidden (if any exist)
  });

  test('should handle pagination', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Check if pagination exists (depends on number of models)
    const paginationExists = await page.getByRole('navigation', { name: /pagination/i }).count() > 0;
    
    if (paginationExists) {
      // Test pagination controls
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        // Should navigate to next page
      }
    }
  });

  test('should show empty state with no results', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Search for non-existent model
    await page.getByPlaceholder('Search models...').fill('nonexistentmodel12345');
    
    // Should show empty state
    await expect(page.getByText('No models found')).toBeVisible();
    await expect(page.getByText('Clear all filters')).toBeVisible();
    
    // Clear filters
    await page.getByText('Clear all filters').click();
    
    // Should show models again
    await expect(page.getByText('GPT-4')).toBeVisible();
  });

  test('should display model pricing and features', async ({ page }) => {
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Should show pricing information
    await expect(page.getByText(/Input:.*Output:/)).toBeVisible();
    
    // Should show context length
    await expect(page.getByText(/Context:.*tokens/)).toBeVisible();
    
    // Should show feature labels
    await expect(page.getByText('Code Generation')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/models');
    
    // Wait for models to load
    await expect(page.getByText('GPT-4')).toBeVisible({ timeout: 10000 });
    
    // Should still display models on mobile
    await expect(page.getByText('by OpenAI')).toBeVisible();
    
    // Modal should work on mobile too
    await page.getByText('GPT-4').first().click();
    await expect(page.getByText('Subscribe to Model')).toBeVisible();
  });
});