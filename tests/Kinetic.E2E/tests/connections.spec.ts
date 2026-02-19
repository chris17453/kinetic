import { test, expect } from '../fixtures/auth';

test.describe('Connections Management', () => {
  test('should display connections page', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    
    await expect(adminPage.locator('[data-testid="connections-header"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="connections-list"]')).toBeVisible();
  });

  test('should open new connection modal', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    
    await adminPage.click('[data-testid="new-connection-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-modal"]')).toBeVisible();
  });

  test('should create SQL Server connection', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    await adminPage.click('[data-testid="new-connection-button"]');
    
    await adminPage.fill('[data-testid="connection-name"]', 'Test SQL Server');
    await adminPage.selectOption('[data-testid="connection-type"]', 'sqlserver');
    await adminPage.fill('[data-testid="connection-host"]', 'localhost');
    await adminPage.fill('[data-testid="connection-port"]', '1433');
    await adminPage.fill('[data-testid="connection-database"]', 'TestDB');
    await adminPage.fill('[data-testid="connection-username"]', 'sa');
    await adminPage.fill('[data-testid="connection-password"]', 'Password123!');
    
    await adminPage.click('[data-testid="save-connection-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-modal"]')).not.toBeVisible();
  });

  test('should create PostgreSQL connection', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    await adminPage.click('[data-testid="new-connection-button"]');
    
    await adminPage.fill('[data-testid="connection-name"]', 'Test PostgreSQL');
    await adminPage.selectOption('[data-testid="connection-type"]', 'postgresql');
    await adminPage.fill('[data-testid="connection-host"]', 'localhost');
    await adminPage.fill('[data-testid="connection-port"]', '5432');
    await adminPage.fill('[data-testid="connection-database"]', 'testdb');
    await adminPage.fill('[data-testid="connection-username"]', 'postgres');
    await adminPage.fill('[data-testid="connection-password"]', 'postgres');
    
    await adminPage.click('[data-testid="save-connection-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-modal"]')).not.toBeVisible();
  });

  test('should test connection', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    await adminPage.click('[data-testid="new-connection-button"]');
    
    await adminPage.fill('[data-testid="connection-name"]', 'Test Connection');
    await adminPage.selectOption('[data-testid="connection-type"]', 'sqlserver');
    await adminPage.fill('[data-testid="connection-host"]', 'localhost');
    await adminPage.fill('[data-testid="connection-port"]', '1433');
    await adminPage.fill('[data-testid="connection-database"]', 'Kinetic');
    await adminPage.fill('[data-testid="connection-username"]', 'sa');
    await adminPage.fill('[data-testid="connection-password"]', 'YourStrong!Passw0rd');
    
    await adminPage.click('[data-testid="test-connection-button"]');
    
    // Should show success or failure message
    await expect(adminPage.locator('[data-testid="test-result"]')).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing connection', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    
    await adminPage.click('[data-testid="connection-item"]');
    await adminPage.click('[data-testid="edit-connection-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-modal"]')).toBeVisible();
    
    await adminPage.fill('[data-testid="connection-name"]', 'Updated Connection Name');
    await adminPage.click('[data-testid="save-connection-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-item"]')).toContainText('Updated Connection Name');
  });

  test('should delete connection', async ({ adminPage }) => {
    await adminPage.goto('/connections');
    
    const connectionCount = await adminPage.locator('[data-testid="connection-item"]').count();
    
    await adminPage.click('[data-testid="connection-item"]');
    await adminPage.click('[data-testid="delete-connection-button"]');
    
    // Confirm deletion
    await adminPage.click('[data-testid="confirm-delete-button"]');
    
    await expect(adminPage.locator('[data-testid="connection-item"]')).toHaveCount(connectionCount - 1);
  });
});
