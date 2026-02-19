import { test, expect } from '../fixtures/auth';

test.describe('Report Viewer', () => {
  const testReportId = 'test-report-id';

  test('should display report with parameters', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    
    await expect(authenticatedPage.locator('[data-testid="report-viewer"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="parameter-form"]')).toBeVisible();
  });

  test('should run report with parameters', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    
    // Fill date parameter
    await authenticatedPage.fill('[data-testid="param-startDate"]', '2024-01-01');
    await authenticatedPage.fill('[data-testid="param-endDate"]', '2024-12-31');
    
    // Run report
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    // Wait for results
    await expect(authenticatedPage.locator('[data-testid="report-results"]')).toBeVisible({ timeout: 30000 });
  });

  test('should display table visualization', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="table-visualization"]')).toBeVisible({ timeout: 30000 });
    await expect(authenticatedPage.locator('[data-testid="table-header"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="table-row"]')).toHaveCount(10);
  });

  test('should paginate table results', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="table-visualization"]')).toBeVisible({ timeout: 30000 });
    
    // Go to next page
    await authenticatedPage.click('[data-testid="next-page-button"]');
    
    // Check page indicator
    await expect(authenticatedPage.locator('[data-testid="page-indicator"]')).toContainText('Page 2');
  });

  test('should sort table by column', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="table-visualization"]')).toBeVisible({ timeout: 30000 });
    
    // Click column header to sort
    await authenticatedPage.click('[data-testid="column-header-name"]');
    
    // Check sort indicator
    await expect(authenticatedPage.locator('[data-testid="column-header-name"] [data-testid="sort-asc"]')).toBeVisible();
  });

  test('should export to Excel', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="report-results"]')).toBeVisible({ timeout: 30000 });
    
    // Open export menu
    await authenticatedPage.click('[data-testid="export-button"]');
    
    // Start download
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="export-excel"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should export to PDF', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="report-results"]')).toBeVisible({ timeout: 30000 });
    
    await authenticatedPage.click('[data-testid="export-button"]');
    
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="export-pdf"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should switch between visualization tabs', async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/reports/${testReportId}`);
    await authenticatedPage.click('[data-testid="run-report-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="report-results"]')).toBeVisible({ timeout: 30000 });
    
    // Switch to chart tab
    await authenticatedPage.click('[data-testid="viz-tab-chart"]');
    await expect(authenticatedPage.locator('[data-testid="chart-visualization"]')).toBeVisible();
    
    // Switch back to table
    await authenticatedPage.click('[data-testid="viz-tab-table"]');
    await expect(authenticatedPage.locator('[data-testid="table-visualization"]')).toBeVisible();
  });
});
