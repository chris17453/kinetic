import { test, expect } from '../fixtures/auth';

test.describe('Report Catalog', () => {
  test('should display catalog page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    await expect(authenticatedPage.locator('[data-testid="catalog-header"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="report-grid"]')).toBeVisible();
  });

  test('should filter reports by category', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    await authenticatedPage.click('[data-testid="category-filter"]');
    await authenticatedPage.click('[data-testid="category-sales"]');
    
    await expect(authenticatedPage.locator('[data-testid="report-card"]')).toHaveCount(1);
  });

  test('should search reports', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    await authenticatedPage.fill('[data-testid="search-input"]', 'monthly');
    await authenticatedPage.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for search results
    await authenticatedPage.waitForResponse(resp => resp.url().includes('/api/catalog'));
  });

  test('should toggle between grid and list view', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    // Default is grid
    await expect(authenticatedPage.locator('[data-testid="report-grid"]')).toBeVisible();
    
    // Switch to list
    await authenticatedPage.click('[data-testid="list-view-button"]');
    await expect(authenticatedPage.locator('[data-testid="report-list"]')).toBeVisible();
    
    // Switch back to grid
    await authenticatedPage.click('[data-testid="grid-view-button"]');
    await expect(authenticatedPage.locator('[data-testid="report-grid"]')).toBeVisible();
  });

  test('should add report to favorites', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    const favoriteButton = authenticatedPage.locator('[data-testid="favorite-button"]').first();
    await favoriteButton.click();
    
    await expect(favoriteButton).toHaveAttribute('data-favorited', 'true');
  });

  test('should filter by favorites', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    await authenticatedPage.click('[data-testid="scope-favorites"]');
    
    // Should only show favorited reports
    await authenticatedPage.waitForResponse(resp => resp.url().includes('/api/catalog'));
  });

  test('should open report from catalog', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/catalog');
    
    await authenticatedPage.click('[data-testid="report-card"]');
    
    await expect(authenticatedPage.url()).toContain('/reports/');
  });
});
