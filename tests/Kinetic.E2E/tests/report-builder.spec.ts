import { test, expect } from '../fixtures/auth';

test.describe('Report Builder', () => {
  test('should create new report', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    await expect(adminPage.locator('[data-testid="report-builder"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="query-editor"]')).toBeVisible();
  });

  test('should select connection', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    await adminPage.click('[data-testid="connection-select"]');
    await adminPage.click('[data-testid="connection-option"]');
    
    await expect(adminPage.locator('[data-testid="connection-select"]')).not.toHaveText('Select connection...');
  });

  test('should write and test query', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    // Select connection first
    await adminPage.click('[data-testid="connection-select"]');
    await adminPage.click('[data-testid="connection-option"]');
    
    // Type query in Monaco editor
    const editor = adminPage.locator('[data-testid="query-editor"] .monaco-editor textarea');
    await editor.fill('SELECT * FROM users LIMIT 10');
    
    // Test query
    await adminPage.click('[data-testid="test-query-button"]');
    
    // Wait for results
    await expect(adminPage.locator('[data-testid="query-results"]')).toBeVisible({ timeout: 10000 });
  });

  test('should auto-detect columns from query results', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    await adminPage.click('[data-testid="connection-select"]');
    await adminPage.click('[data-testid="connection-option"]');
    
    const editor = adminPage.locator('[data-testid="query-editor"] .monaco-editor textarea');
    await editor.fill('SELECT id, name, email FROM users LIMIT 10');
    
    await adminPage.click('[data-testid="test-query-button"]');
    
    // Columns should be auto-populated
    await adminPage.click('[data-testid="columns-tab"]');
    await expect(adminPage.locator('[data-testid="column-item"]')).toHaveCount(3);
  });

  test('should add parameter', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    await adminPage.click('[data-testid="parameters-tab"]');
    await adminPage.click('[data-testid="add-parameter-button"]');
    
    await adminPage.fill('[data-testid="param-name-input"]', 'startDate');
    await adminPage.selectOption('[data-testid="param-type-select"]', 'date');
    await adminPage.fill('[data-testid="param-label-input"]', 'Start Date');
    
    await adminPage.click('[data-testid="save-parameter-button"]');
    
    await expect(adminPage.locator('[data-testid="parameter-item"]')).toHaveCount(1);
  });

  test('should configure visualization', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    await adminPage.click('[data-testid="visualization-tab"]');
    await adminPage.click('[data-testid="viz-type-bar"]');
    
    await expect(adminPage.locator('[data-testid="bar-chart-config"]')).toBeVisible();
  });

  test('should save report', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    // Fill required fields
    await adminPage.fill('[data-testid="report-name-input"]', 'Test Report');
    await adminPage.click('[data-testid="connection-select"]');
    await adminPage.click('[data-testid="connection-option"]');
    
    const editor = adminPage.locator('[data-testid="query-editor"] .monaco-editor textarea');
    await editor.fill('SELECT * FROM users LIMIT 10');
    
    // Save
    await adminPage.click('[data-testid="save-report-button"]');
    
    // Should redirect to report view
    await expect(adminPage.url()).toContain('/reports/');
    await expect(adminPage.url()).not.toContain('/new');
  });

  test('should reorder columns via drag and drop', async ({ adminPage }) => {
    await adminPage.goto('/reports/new');
    
    // Setup report with columns
    await adminPage.click('[data-testid="connection-select"]');
    await adminPage.click('[data-testid="connection-option"]');
    
    const editor = adminPage.locator('[data-testid="query-editor"] .monaco-editor textarea');
    await editor.fill('SELECT id, name, email FROM users');
    await adminPage.click('[data-testid="test-query-button"]');
    
    // Go to columns tab
    await adminPage.click('[data-testid="columns-tab"]');
    
    // Drag first column to third position
    const firstColumn = adminPage.locator('[data-testid="column-item"]').first();
    const thirdColumn = adminPage.locator('[data-testid="column-item"]').nth(2);
    
    await firstColumn.dragTo(thirdColumn);
  });
});
