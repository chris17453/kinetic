import { test, expect } from '../fixtures/auth';

test.describe('Admin - Users & Groups', () => {
  test('should display admin users page', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    
    await expect(adminPage.locator('[data-testid="admin-users-header"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="users-table"]')).toBeVisible();
  });

  test('should create new user', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    
    await adminPage.click('[data-testid="new-user-button"]');
    
    await adminPage.fill('[data-testid="user-email"]', `testuser_${Date.now()}@kinetic.local`);
    await adminPage.fill('[data-testid="user-name"]', 'Test User');
    await adminPage.fill('[data-testid="user-password"]', 'TestPass123!');
    
    await adminPage.click('[data-testid="save-user-button"]');
    
    await expect(adminPage.locator('[data-testid="user-modal"]')).not.toBeVisible();
  });

  test('should display admin groups page', async ({ adminPage }) => {
    await adminPage.goto('/admin/groups');
    
    await expect(adminPage.locator('[data-testid="admin-groups-header"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="groups-table"]')).toBeVisible();
  });

  test('should create new group', async ({ adminPage }) => {
    await adminPage.goto('/admin/groups');
    
    await adminPage.click('[data-testid="new-group-button"]');
    
    await adminPage.fill('[data-testid="group-name"]', `Test Group ${Date.now()}`);
    await adminPage.fill('[data-testid="group-description"]', 'A test group');
    
    await adminPage.click('[data-testid="save-group-button"]');
    
    await expect(adminPage.locator('[data-testid="group-modal"]')).not.toBeVisible();
  });

  test('should add user to group', async ({ adminPage }) => {
    await adminPage.goto('/admin/groups');
    
    await adminPage.click('[data-testid="group-row"]');
    await adminPage.click('[data-testid="manage-members-button"]');
    
    await adminPage.click('[data-testid="add-member-button"]');
    await adminPage.click('[data-testid="user-picker"]');
    await adminPage.click('[data-testid="user-option"]');
    
    await adminPage.click('[data-testid="confirm-add-member"]');
    
    await expect(adminPage.locator('[data-testid="member-row"]')).toHaveCount(1);
  });

  test('should assign permissions to group', async ({ adminPage }) => {
    await adminPage.goto('/admin/groups');
    
    await adminPage.click('[data-testid="group-row"]');
    await adminPage.click('[data-testid="manage-permissions-button"]');
    
    await adminPage.click('[data-testid="permission-reports:create"]');
    await adminPage.click('[data-testid="permission-connections:view"]');
    
    await adminPage.click('[data-testid="save-permissions-button"]');
    
    await expect(adminPage.locator('[data-testid="permissions-modal"]')).not.toBeVisible();
  });

  test('should display organization branding page', async ({ adminPage }) => {
    await adminPage.goto('/admin/branding');
    
    await expect(adminPage.locator('[data-testid="branding-header"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="logo-upload"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="color-picker-primary"]')).toBeVisible();
  });

  test('should update organization branding', async ({ adminPage }) => {
    await adminPage.goto('/admin/branding');
    
    await adminPage.fill('[data-testid="org-name-input"]', 'Test Organization');
    await adminPage.click('[data-testid="color-picker-primary"]');
    await adminPage.fill('[data-testid="color-input"]', '#3B82F6');
    
    await adminPage.click('[data-testid="save-branding-button"]');
    
    await expect(adminPage.locator('[data-testid="save-success"]')).toBeVisible();
  });
});
