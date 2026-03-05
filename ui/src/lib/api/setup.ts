import axios from 'axios';

// Separate axios instance for setup — no auth interceptor (no token exists yet)
const setupApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/setup',
  headers: { 'Content-Type': 'application/json' },
});

export interface SetupStatus {
  needsSetup: boolean;
  needsAdmin: boolean;
  configured: {
    database: boolean;
    rabbitMq: boolean;
    redis: boolean;
    encryption: boolean;
    smtp: boolean;
  };
}

export interface TestResult {
  success: boolean;
  error?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  useSsl: boolean;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

export interface SetupConfig {
  databaseConnectionString: string;
  rabbitMqConnectionString: string;
  redisConnectionString: string;
  encryptionKey: string;
  adminEmail: string;
  adminDisplayName: string;
  adminPassword: string;
  smtp?: SmtpConfig;
}

export interface AdminAccount {
  email: string;
  displayName: string;
  password: string;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await setupApi.get<SetupStatus>('/status');
  return data;
}

export async function testDatabase(connectionString: string): Promise<TestResult> {
  const { data } = await setupApi.post<TestResult>('/test-database', { connectionString });
  return data;
}

export async function testRabbitMq(connectionString: string): Promise<TestResult> {
  const { data } = await setupApi.post<TestResult>('/test-rabbitmq', { connectionString });
  return data;
}

export async function testRedis(connectionString: string): Promise<TestResult> {
  const { data } = await setupApi.post<TestResult>('/test-redis', { connectionString });
  return data;
}

export async function testSmtp(config: SmtpConfig): Promise<TestResult> {
  const { data } = await setupApi.post<TestResult>('/test-smtp', config);
  return data;
}

export async function completeSetup(config: SetupConfig): Promise<void> {
  await setupApi.post('/complete', config);
}

export async function createAdmin(admin: AdminAccount): Promise<void> {
  await setupApi.post('/admin', admin);
}
