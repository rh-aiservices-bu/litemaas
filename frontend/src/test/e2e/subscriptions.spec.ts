import { test, expect } from '@playwright/test';

test.describe('Subscriptions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for E2E tests
    await page.goto('/login');
    await page.getByText('Login as Admin (Test)').click();
    await expect(page).toHaveURL('/');
  });

  test('should display subscriptions page with user subscriptions', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for page to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    // Should show subscriptions after loading (or empty state)
    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // If subscriptions exist, verify their display
      await expect(page.getByText('GPT-4')).toBeVisible();
      await expect(page.getByText('Active')).toBeVisible();

      // Should show usage information
      await expect(page.getByText(/\d+\/\d+/)).toBeVisible(); // Usage format like "500/10,000"
      await expect(page.getByText(/\d+%/)).toBeVisible(); // Usage percentage
    } else {
      // If no subscriptions, should show empty state
      await expect(page.getByText('No subscriptions found')).toBeVisible();
      await expect(page.getByText('Browse models to create your first subscription')).toBeVisible();
    }
  });

  test('should allow filtering subscriptions by status', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for page to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    // Look for status filter dropdown
    const statusFilter = page
      .getByText('All Statuses')
      .or(page.getByRole('button', { name: /status/i }));
    if (await statusFilter.isVisible()) {
      await statusFilter.click();

      // Should show status options
      await expect(page.getByText('Active')).toBeVisible();
      await expect(page.getByText('Cancelled')).toBeVisible();

      // Select active only
      await page.getByText('Active').click();

      // Should filter results
      const subscriptionCards = page
        .locator('[data-testid="subscription-card"]')
        .or(page.locator('.pf-v6-c-card').filter({ hasText: 'GPT' }));

      // All visible subscriptions should be active
      if ((await subscriptionCards.count()) > 0) {
        await expect(subscriptionCards.first()).toContainText('Active');
      }
    }
  });

  test('should open subscription details modal', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for subscriptions to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    // Check if we have any subscriptions
    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Click on subscription card
      await page.getByText('GPT-4').first().click();

      // Should open modal with details
      await expect(page.getByText('Subscription Details')).toBeVisible();
      await expect(page.getByText('Usage Details')).toBeVisible();
      await expect(page.getByText('Pricing Information')).toBeVisible();

      // Should show quota information
      await expect(page.getByText('Request Quota')).toBeVisible();
      await expect(page.getByText('Token Quota')).toBeVisible();

      // Should show usage utilization
      await expect(page.getByText(/\d+%.*utilization/i)).toBeVisible();

      // Close modal
      await page
        .getByText('Close')
        .or(page.getByRole('button', { name: 'Close' }))
        .click();
      await expect(page.getByText('Subscription Details')).not.toBeVisible();
    } else {
      // If no subscriptions, skip this test
      test.skip();
    }
  });

  test('should allow quota updates', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for subscriptions to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Click on subscription card
      await page.getByText('GPT-4').first().click();

      // Should open modal
      await expect(page.getByText('Subscription Details')).toBeVisible();

      // Click on update quotas button
      const updateButton = page
        .getByText('Update Quotas')
        .or(page.getByRole('button', { name: /update/i }));
      if (await updateButton.isVisible()) {
        await updateButton.click();

        // Should show quota form
        await expect(page.getByLabel('Request Quota')).toBeVisible();
        await expect(page.getByLabel('Token Quota')).toBeVisible();

        // Update quota values
        await page.getByLabel('Request Quota').fill('20000');
        await page.getByLabel('Token Quota').fill('2000000');

        // Save changes
        await page
          .getByText('Save Changes')
          .or(page.getByRole('button', { name: 'Save' }))
          .click();

        // Should show success notification
        await expect(page.getByText('Quotas updated successfully')).toBeVisible({ timeout: 5000 });
      }
    } else {
      test.skip();
    }
  });

  test('should display pricing information', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for subscriptions to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Should show pricing on card
      await expect(page.getByText(/\$\d+\.\d+/)).toBeVisible(); // Cost format like "$4.50"
      await expect(page.getByText('this month')).toBeVisible();

      // Click on subscription to see detailed pricing
      await page.getByText('GPT-4').first().click();

      await expect(page.getByText('Subscription Details')).toBeVisible();
      await expect(page.getByText('Pricing Information')).toBeVisible();

      // Should show detailed token pricing
      await expect(page.getByText(/Input.*\$0\.\d+.*per token/i)).toBeVisible();
      await expect(page.getByText(/Output.*\$0\.\d+.*per token/i)).toBeVisible();

      // Should show estimated costs
      await expect(page.getByText('Estimated Cost')).toBeVisible();
      await expect(page.getByText(/Based on current usage/i)).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should handle subscription cancellation', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for subscriptions to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Click on subscription card
      await page.getByText('GPT-4').first().click();

      // Should open modal
      await expect(page.getByText('Subscription Details')).toBeVisible();

      // Look for cancel button
      const cancelButton = page
        .getByText('Cancel Subscription')
        .or(page.getByRole('button', { name: /cancel.*subscription/i }));

      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Should show confirmation dialog
        await expect(page.getByText('Confirm Cancellation')).toBeVisible();
        await expect(page.getByText('Are you sure you want to cancel')).toBeVisible();

        // Don't actually cancel in tests - click "No" or "Cancel"
        const noButton = page
          .getByText('No, Keep Subscription')
          .or(page.getByRole('button', { name: /no|cancel/i }));

        if (await noButton.isVisible()) {
          await noButton.click();
        }

        // Modal should still be open
        await expect(page.getByText('Subscription Details')).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('should navigate to create subscription from empty state', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for page to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    // Check for empty state
    const isEmptyState = await page
      .getByText('No subscriptions found')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isEmptyState) {
      // Click browse models button
      await page.getByText('Browse Models').click();

      // Should navigate to models page
      await expect(page).toHaveURL('/models');
      await expect(page.getByText('Model Discovery')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should show usage warnings for high utilization', async ({ page }) => {
    await page.goto('/subscriptions');

    // Wait for subscriptions to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Look for high usage indicators (this depends on test data)
      const highUsageIndicators = [
        page.getByText(/9[0-9]%/), // 90%+ usage
        page.getByText('High Usage'),
        page.locator('.pf-m-warning'),
        page.locator('.pf-m-danger'),
      ];

      // Check if any high usage indicators are visible
      const hasWarning = await Promise.all(
        highUsageIndicators.map((indicator) => indicator.isVisible().catch(() => false)),
      ).then((results) => results.some(Boolean));

      if (hasWarning) {
        // Should show warning styling or messages
        await expect(page.getByText(/usage.*high|warning|alert/i)).toBeVisible();
      }

      // Click on subscription to see detailed warnings
      await page.getByText('GPT-4').first().click();

      if (hasWarning) {
        await expect(page.getByText('Usage Alert')).toBeVisible();
        await expect(page.getByText(/approaching.*limit/i)).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/subscriptions');

    // Wait for page to load
    await expect(page.getByText('My Subscriptions')).toBeVisible();

    // Should still display properly on mobile
    const hasSubscriptions = await page
      .getByText('GPT-4')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSubscriptions) {
      // Subscription cards should be stacked vertically
      await expect(page.getByText('GPT-4')).toBeVisible();
      await expect(page.getByText('Active')).toBeVisible();

      // Modal should work on mobile too
      await page.getByText('GPT-4').first().click();
      await expect(page.getByText('Subscription Details')).toBeVisible();

      // Modal should be full-width on mobile
      const modal = page.getByText('Subscription Details').locator('..');
      const modalWidth = await modal.boundingBox().then((box) => box?.width || 0);
      const viewportWidth = 375;

      // Modal should take up most of the viewport width on mobile
      expect(modalWidth / viewportWidth).toBeGreaterThan(0.8);
    } else {
      // Empty state should work on mobile
      await expect(page.getByText('No subscriptions found')).toBeVisible();
      await expect(page.getByText('Browse Models')).toBeVisible();
    }
  });
});
