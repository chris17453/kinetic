import { test, expect } from '../fixtures/auth';

test.describe('Data Upload', () => {
  test('should display upload page', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    await expect(adminPage.locator('[data-testid="upload-header"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="dropzone"]')).toBeVisible();
  });

  test('should upload Excel file', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    // Upload file
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    await adminPage.click('[data-testid="dropzone"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-data.xlsx');
    
    // Should show file analysis
    await expect(adminPage.locator('[data-testid="file-analysis"]')).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator('[data-testid="sheet-list"]')).toBeVisible();
  });

  test('should preview sheet data', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    await adminPage.click('[data-testid="dropzone"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-data.xlsx');
    
    await expect(adminPage.locator('[data-testid="file-analysis"]')).toBeVisible({ timeout: 10000 });
    
    // Click preview
    await adminPage.click('[data-testid="preview-button"]');
    
    await expect(adminPage.locator('[data-testid="preview-modal"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="preview-table"]')).toBeVisible();
  });

  test('should create new database from upload', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    await adminPage.click('[data-testid="dropzone"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-data.xlsx');
    
    await expect(adminPage.locator('[data-testid="file-analysis"]')).toBeVisible({ timeout: 10000 });
    
    // Select create new database
    await adminPage.click('[data-testid="target-new-db"]');
    await adminPage.fill('[data-testid="new-db-name"]', 'TestUpload_' + Date.now());
    
    // Import
    await adminPage.click('[data-testid="import-button"]');
    
    await expect(adminPage.locator('[data-testid="import-success"]')).toBeVisible({ timeout: 30000 });
  });

  test('should map columns to existing table', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    await adminPage.click('[data-testid="dropzone"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-data.xlsx');
    
    await expect(adminPage.locator('[data-testid="file-analysis"]')).toBeVisible({ timeout: 10000 });
    
    // Select existing database
    await adminPage.click('[data-testid="target-existing-db"]');
    await adminPage.click('[data-testid="database-select"]');
    await adminPage.click('[data-testid="database-option"]');
    
    // Open column mapping
    await adminPage.click('[data-testid="map-columns-button"]');
    
    await expect(adminPage.locator('[data-testid="column-mapping"]')).toBeVisible();
  });

  test('should upload CSV file', async ({ adminPage }) => {
    await adminPage.goto('/upload');
    
    const fileChooserPromise = adminPage.waitForEvent('filechooser');
    await adminPage.click('[data-testid="dropzone"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('./fixtures/test-data.csv');
    
    await expect(adminPage.locator('[data-testid="file-analysis"]')).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator('[data-testid="table-name"]')).toBeVisible();
  });
});
