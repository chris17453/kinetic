import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_DIR = path.resolve(__dirname, '../../src/Kinetic.Api');
const CONFIG_PATH = path.join(API_DIR, 'kinetic.config.json');
const API_URL = 'http://localhost:5000';

let apiProcess: ChildProcess | null = null;

function removeConfigFile() {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
}

function dropDatabase() {
  try {
    execSync(
      `docker exec kinetic-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Kinetic@Dev123!" -C -Q "IF DB_ID('Kinetic') IS NOT NULL BEGIN ALTER DATABASE [Kinetic] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [Kinetic]; END"`,
      { timeout: 15000, stdio: 'pipe' }
    );
  } catch {
    // DB might not exist — that's fine
  }
}

function killApiOnPort() {
  try {
    execSync('kill $(lsof -ti:5000) 2>/dev/null', { stdio: 'pipe' });
  } catch {
    // nothing running on port
  }
}

function startApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('API startup timed out')), 30000);

    apiProcess = spawn('dotnet', ['run', '--no-launch-profile'], {
      cwd: API_DIR,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: 'http://localhost:5000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (data: Buffer) => {
      const line = data.toString();
      if (line.includes('Now listening on')) {
        clearTimeout(timeout);
        resolve();
      }
    };

    apiProcess.stdout?.on('data', onData);
    apiProcess.stderr?.on('data', onData);

    apiProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    apiProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`API exited with code ${code}`));
      }
    });
  });
}

function stopApi(alsoKillPort = false) {
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
    apiProcess = null;
  }
  if (alsoKillPort) {
    killApiOnPort();
  }
}

async function waitForApi(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`API at ${url} not ready within ${timeoutMs}ms`);
}

test.describe('Setup Wizard', () => {
  test.beforeAll(async () => {
    // Clean slate
    killApiOnPort();
    removeConfigFile();
    dropDatabase();

    // Build the API
    execSync('dotnet build --no-restore -v q', { cwd: API_DIR, timeout: 60000, stdio: 'pipe' });

    // Start API in setup mode (no config file = setup mode)
    await startApi();
    await waitForApi(`${API_URL}/api/setup/status`);
  });

  test.afterAll(() => {
    stopApi(true);
  });

  test('complete setup wizard and login', async ({ page }) => {
    test.setTimeout(120_000);

    // Navigate to the app — it should redirect to /setup
    await page.goto('/');

    // The setup page should load (may redirect to /setup)
    await page.waitForURL(/\/(setup)?$/, { timeout: 10000 });

    // ─── Step 1: Database ──────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Database' })).toBeVisible({ timeout: 10000 });

    // The connection string should be pre-filled
    const dbTextarea = page.locator('textarea');
    await expect(dbTextarea).toHaveValue(/Server=localhost/);

    // Test connection
    await page.getByRole('button', { name: /Test Connection/i }).click();

    // Wait for success
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 15000 });

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // ─── Step 2: Message Broker (RabbitMQ) ─────────────────────────────
    await expect(page.getByRole('heading', { name: 'Message Broker' })).toBeVisible({ timeout: 5000 });

    // Pre-filled RabbitMQ connection string
    const rmqInput = page.locator('input[type="text"]').first();
    await expect(rmqInput).toHaveValue(/amqp:\/\//);

    // Test connection
    await page.getByRole('button', { name: /Test Connection/i }).click();
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 15000 });

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // ─── Step 3: Cache (Redis) ─────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Cache' })).toBeVisible({ timeout: 5000 });

    // Pre-filled Redis connection string
    const redisInput = page.locator('input[type="text"]').first();
    await expect(redisInput).toHaveValue('localhost:6379');

    // Test connection
    await page.getByRole('button', { name: /Test Connection/i }).click();
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 15000 });

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // ─── Step 4: Security ──────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible({ timeout: 5000 });

    // Encryption key should be auto-generated (44 chars for base64 of 32 bytes)
    const encKeyInput = page.locator('input[type="text"]').first();
    const encKeyValue = await encKeyInput.inputValue();
    expect(encKeyValue.length).toBeGreaterThanOrEqual(32);

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // ─── Step 5: Admin Account ─────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Admin Account' })).toBeVisible({ timeout: 5000 });

    // Fill admin details
    await page.getByPlaceholder('Jane Smith').fill('Test Admin');
    await page.getByPlaceholder('admin@example.com').fill('admin@test.com');

    // Fill password
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Admin@12345!');
    await passwordInputs.nth(1).fill('Admin@12345!');

    // Wait for form validation — password strength should show "Strong"
    await expect(page.getByText('Strong')).toBeVisible({ timeout: 3000 });

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // ─── Step 6: Review ────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible({ timeout: 5000 });

    // Verify summary shows our values
    await expect(page.getByText('admin@test.com')).toBeVisible();
    await expect(page.getByText('Test Admin')).toBeVisible();

    // Click Complete Setup
    await page.getByRole('button', { name: /Complete Setup/i }).click();

    // Wait for completion
    await expect(page.getByText('Setup Complete!')).toBeVisible({ timeout: 30000 });

    // Verify config file was written
    expect(existsSync(CONFIG_PATH)).toBe(true);

    // ─── Verify normal mode works after restart ───────────────────────

    // The API called StopApplication() with a 1.5s delay — wait for it to shut down
    // Don't use killApiOnPort as it would also kill browser connections
    await new Promise(r => setTimeout(r, 3000));
    stopApi(); // kill the process if it hasn't exited
    await new Promise(r => setTimeout(r, 1000));

    // Restart API in normal mode (config file exists now)
    await startApi();
    await waitForApi(`${API_URL}/api/setup/status`);

    // Verify setup status — should report fully configured
    const statusRes = await fetch(`${API_URL}/api/setup/status`);
    const status = await statusRes.json();
    expect(status.needsSetup).toBe(false);
    expect(status.needsAdmin).toBe(false);
    expect(status.configured.database).toBe(true);
    expect(status.configured.rabbitMq).toBe(true);
    expect(status.configured.redis).toBe(true);
    expect(status.configured.encryption).toBe(true);

    // Verify login works with admin credentials via API
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'Admin@12345!' }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeTruthy();
    expect(loginData.user.email).toBe('admin@test.com');
    expect(loginData.user.displayName).toBe('Test Admin');
    expect(loginData.user.groups).toHaveLength(1);
    expect(loginData.user.groups[0].name).toBe('Administrators');
    expect(loginData.user.groups[0].role).toBe('Owner');

    // Verify /api/setup/complete is now blocked (returns 404)
    const completeRes = await fetch(`${API_URL}/api/setup/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(completeRes.status).toBe(404);
  });
});
