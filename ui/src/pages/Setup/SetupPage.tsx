import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getSetupStatus,
  testDatabase,
  testRabbitMq,
  testRedis,
  testSmtp,
  completeSetup,
  createAdmin,
  type SetupStatus,
  type TestResult,
} from '../../lib/api/setup';

// ─── Schemas ────────────────────────────────────────────────────────────────

const databaseSchema = z.object({
  connectionString: z.string().min(1, 'Connection string is required'),
});

const rabbitMqSchema = z.object({
  connectionString: z.string().min(1, 'Connection string is required'),
});

const redisSchema = z.object({
  connectionString: z.string().min(1, 'Connection string is required'),
});

const securitySchema = z.object({
  encryptionKey: z.string().min(32, 'Encryption key must be at least 32 characters'),
});

const adminSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type DatabaseValues = z.infer<typeof databaseSchema>;
type RabbitMqValues = z.infer<typeof rabbitMqSchema>;
type RedisValues = z.infer<typeof redisSchema>;
type SecurityValues = z.infer<typeof securitySchema>;
type AdminValues = z.infer<typeof adminSchema>;

const smtpSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  useSsl: z.boolean(),
  username: z.string(),
  password: z.string(),
  fromAddress: z.string(),
  fromName: z.string(),
});
type SmtpValues = z.infer<typeof smtpSchema>;

const STEPS = ['Database', 'Message Broker', 'Cache', 'Security', 'Email (Optional)', 'Admin Account', 'Review'] as const;

const strengthCriteria = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special char', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_COLOR = ['danger', 'danger', 'warning', 'warning', 'success', 'success'] as const;
const STRENGTH_LABEL = ['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'] as const;
const STRENGTH_BAR_COLOR: Record<string, string> = {
  danger: '#dc3545',
  warning: '#fd7e14',
  success: '#198754',
};

function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Test results per step
  const [dbTestResult, setDbTestResult] = useState<TestResult | null>(null);
  const [dbTesting, setDbTesting] = useState(false);
  const [rmqTestResult, setRmqTestResult] = useState<TestResult | null>(null);
  const [rmqTesting, setRmqTesting] = useState(false);
  const [redisTestResult, setRedisTestResult] = useState<TestResult | null>(null);
  const [redisTesting, setRedisTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<TestResult | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);

  // Forms
  const dbForm = useForm<DatabaseValues>({
    resolver: zodResolver(databaseSchema),
    defaultValues: { connectionString: 'Server=localhost;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True' },
  });
  const rmqForm = useForm<RabbitMqValues>({
    resolver: zodResolver(rabbitMqSchema),
    defaultValues: { connectionString: 'amqp://guest:guest@localhost:5672' },
  });
  const redisForm = useForm<RedisValues>({
    resolver: zodResolver(redisSchema),
    defaultValues: { connectionString: 'localhost:6379' },
  });
  const securityForm = useForm<SecurityValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: { encryptionKey: generateEncryptionKey() },
  });
  const smtpForm = useForm<SmtpValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: { host: '', port: 587, useSsl: true, username: '', password: '', fromAddress: '', fromName: 'Kinetic' },
  });
  const adminForm = useForm<AdminValues>({ resolver: zodResolver(adminSchema) });

  const adminPassword = adminForm.watch('password', '');
  const metCount = strengthCriteria.filter(c => c.test(adminPassword)).length;
  const strengthColor = STRENGTH_COLOR[metCount] ?? 'danger';
  const strengthLabel = STRENGTH_LABEL[metCount] ?? 'Weak';

  // Fetch setup status on mount
  useEffect(() => {
    getSetupStatus().then(s => {
      setStatus(s);
      // If only admin is needed, jump to admin step
      if (!s.needsSetup && s.needsAdmin) setStep(5);
      // If fully set up, redirect away
      if (!s.needsSetup && !s.needsAdmin) navigate('/', { replace: true });
    }).catch(() => {
      // API not reachable — probably needs setup
    });
  }, [navigate]);

  // ─── Connection tests ──────────────────────────────────────────────────────

  const handleTestDb = useCallback(async () => {
    const valid = await dbForm.trigger();
    if (!valid) return;
    setDbTesting(true);
    setDbTestResult(null);
    try {
      const result = await testDatabase(dbForm.getValues('connectionString'));
      setDbTestResult(result);
    } catch {
      setDbTestResult({ success: false, error: 'Failed to reach the API.' });
    } finally {
      setDbTesting(false);
    }
  }, [dbForm]);

  const handleTestRmq = useCallback(async () => {
    const valid = await rmqForm.trigger();
    if (!valid) return;
    setRmqTesting(true);
    setRmqTestResult(null);
    try {
      const result = await testRabbitMq(rmqForm.getValues('connectionString'));
      setRmqTestResult(result);
    } catch {
      setRmqTestResult({ success: false, error: 'Failed to reach the API.' });
    } finally {
      setRmqTesting(false);
    }
  }, [rmqForm]);

  const handleTestRedis = useCallback(async () => {
    const valid = await redisForm.trigger();
    if (!valid) return;
    setRedisTesting(true);
    setRedisTestResult(null);
    try {
      const result = await testRedis(redisForm.getValues('connectionString'));
      setRedisTestResult(result);
    } catch {
      setRedisTestResult({ success: false, error: 'Failed to reach the API.' });
    } finally {
      setRedisTesting(false);
    }
  }, [redisForm]);

  const handleTestSmtp = useCallback(async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const values = smtpForm.getValues();
      const result = await testSmtp(values);
      setSmtpTestResult(result);
    } catch {
      setSmtpTestResult({ success: false, error: 'Failed to reach the API.' });
    } finally {
      setSmtpTesting(false);
    }
  }, [smtpForm]);

  // ─── Step navigation ───────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return dbTestResult?.success === true;
      case 1: return rmqTestResult?.success === true;
      case 2: return redisTestResult?.success === true;
      case 3: return securityForm.formState.isValid || securityForm.getValues('encryptionKey').length >= 32;
      case 4: return true; // SMTP is optional
      case 5: return adminForm.formState.isValid;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      const valid = await securityForm.trigger();
      if (!valid) return;
    }
    if (step === 5) {
      const valid = await adminForm.trigger();
      if (!valid) return;
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  // ─── Complete setup ────────────────────────────────────────────────────────

  const handleComplete = async () => {
    setCompleting(true);
    setGlobalError(null);
    try {
      if (status && !status.needsSetup && status.needsAdmin) {
        // Admin-only mode (post-restart)
        await createAdmin({
          email: adminForm.getValues('email'),
          displayName: adminForm.getValues('displayName'),
          password: adminForm.getValues('password'),
        });
      } else {
        const smtpValues = smtpForm.getValues();
        const smtpConfig = smtpValues.host ? smtpValues : undefined;
        await completeSetup({
          databaseConnectionString: dbForm.getValues('connectionString'),
          rabbitMqConnectionString: rmqForm.getValues('connectionString'),
          redisConnectionString: redisForm.getValues('connectionString'),
          encryptionKey: securityForm.getValues('encryptionKey'),
          adminEmail: adminForm.getValues('email'),
          adminDisplayName: adminForm.getValues('displayName'),
          adminPassword: adminForm.getValues('password'),
          smtp: smtpConfig,
        });
      }
      setCompleted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed. Please try again.';
      setGlobalError(msg);
    } finally {
      setCompleting(false);
    }
  };

  // ─── Admin-only mode ───────────────────────────────────────────────────────

  const isAdminOnly = status ? !status.needsSetup && status.needsAdmin : false;
  const visibleSteps = isAdminOnly ? ['Admin Account'] : [...STEPS];
  const effectiveStep = isAdminOnly ? 0 : step;

  // ─── Redirect after restart ─────────────────────────────────────────────────

  useEffect(() => {
    if (!completed || isAdminOnly) return;
    const interval = setInterval(async () => {
      try {
        const s = await getSetupStatus();
        if (!s.needsSetup && !s.needsAdmin) {
          clearInterval(interval);
          window.location.href = '/login';
        }
      } catch {
        // API still restarting — keep polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [completed, isAdminOnly]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-vh-100 d-flex">
      {/* Left brand panel */}
      <div
        className="d-none d-lg-flex flex-column justify-content-between p-5 text-white"
        style={{ width: '42%', background: 'linear-gradient(135deg, #0d6efd 0%, #6610f2 100%)', flexShrink: 0 }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-bolt-lightning fa-lg"></i>
          <span className="fw-bold fs-4">Kinetic</span>
        </div>
        <div>
          <h2 className="fw-bold display-6 mb-3">Welcome to Kinetic</h2>
          <p className="opacity-75 mb-4">
            Let's get your reporting platform configured. This wizard will walk you through connecting
            your infrastructure and creating your admin account.
          </p>

          {/* Progress */}
          <div className="d-flex flex-column gap-2">
            {visibleSteps.map((s, i) => {
              const done = isAdminOnly ? completed : i < step;
              const active = i === effectiveStep;
              return (
                <div key={s} className="d-flex align-items-center gap-2">
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                      background: done ? 'rgba(255,255,255,0.9)' : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                      color: done ? '#6610f2' : '#fff',
                    }}
                  >
                    {done ? <i className="fa-solid fa-check" style={{ fontSize: 12 }}></i> : i + 1}
                  </div>
                  <span className={`small ${active ? 'fw-semibold' : 'opacity-75'}`}>{s}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="small opacity-50 mb-0">&copy; {new Date().getFullYear()} Kinetic Reports</p>
      </div>

      {/* Right panel */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 bg-light">
        <div style={{ width: '100%', maxWidth: 540 }}>
          {/* Mobile header */}
          <div className="d-lg-none text-center mb-4">
            <i className="fa-solid fa-bolt-lightning fa-2x text-primary mb-2"></i>
            <h5 className="fw-bold mb-1">Kinetic Setup</h5>
            <p className="text-muted small">Step {effectiveStep + 1} of {visibleSteps.length}</p>
          </div>

          {/* Completed state */}
          {completed ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-5 text-center">
                <div className="mb-3">
                  <i className="fa-solid fa-circle-check text-success" style={{ fontSize: 48 }}></i>
                </div>
                <h4 className="fw-bold mb-2">Setup Complete!</h4>
                {isAdminOnly ? (
                  <>
                    <p className="text-muted mb-4">
                      Your admin account has been created. You can now sign in.
                    </p>
                    <button className="btn btn-primary fw-semibold" onClick={() => navigate('/login', { replace: true })}>
                      <i className="fa-solid fa-right-to-bracket me-2"></i>
                      Go to Login
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-muted mb-4">
                      Configuration has been saved and the database has been initialized.
                      The application is restarting — you'll be redirected to the login page shortly.
                    </p>
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Restarting...</span>
                    </div>
                    <p className="text-muted small mt-3">
                      If you're not redirected,{' '}
                      <a href="/login" className="text-decoration-none">click here</a>.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                {globalError && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3">
                    <i className="fa-solid fa-circle-xmark"></i>
                    <span>{globalError}</span>
                  </div>
                )}

                {/* Step content */}
                {!isAdminOnly && step === 0 && (
                  <DatabaseStep
                    form={dbForm}
                    testResult={dbTestResult}
                    testing={dbTesting}
                    onTest={handleTestDb}
                  />
                )}
                {!isAdminOnly && step === 1 && (
                  <RabbitMqStep
                    form={rmqForm}
                    testResult={rmqTestResult}
                    testing={rmqTesting}
                    onTest={handleTestRmq}
                  />
                )}
                {!isAdminOnly && step === 2 && (
                  <RedisStep
                    form={redisForm}
                    testResult={redisTestResult}
                    testing={redisTesting}
                    onTest={handleTestRedis}
                  />
                )}
                {!isAdminOnly && step === 3 && (
                  <SecurityStep form={securityForm} />
                )}
                {!isAdminOnly && step === 4 && (
                  <SmtpStep
                    form={smtpForm}
                    testResult={smtpTestResult}
                    testing={smtpTesting}
                    onTest={handleTestSmtp}
                  />
                )}
                {(isAdminOnly || step === 5) && (
                  <AdminStep
                    form={adminForm}
                    password={adminPassword}
                    metCount={metCount}
                    strengthColor={strengthColor}
                    strengthLabel={strengthLabel}
                  />
                )}
                {!isAdminOnly && step === 6 && (
                  <ReviewStep
                    db={dbForm.getValues('connectionString')}
                    rmq={rmqForm.getValues('connectionString')}
                    redis={redisForm.getValues('connectionString')}
                    encKey={securityForm.getValues('encryptionKey')}
                    smtpHost={smtpForm.getValues('host')}
                    adminEmail={adminForm.getValues('email')}
                    adminName={adminForm.getValues('displayName')}
                  />
                )}

                {/* Navigation */}
                <div className="d-flex justify-content-between mt-4 pt-2 border-top">
                  {!isAdminOnly && step > 0 ? (
                    <button className="btn btn-outline-secondary" onClick={handleBack}>
                      <i className="fa-solid fa-arrow-left me-2"></i>Back
                    </button>
                  ) : <div />}

                  {(isAdminOnly || step === STEPS.length - 1) ? (
                    <button
                      className="btn btn-primary fw-semibold"
                      onClick={isAdminOnly ? handleComplete : handleComplete}
                      disabled={completing || (isAdminOnly && !adminForm.formState.isValid)}
                    >
                      {completing ? (
                        <><span className="spinner-border spinner-border-sm me-2"></span>Setting up...</>
                      ) : (
                        <><i className="fa-solid fa-rocket me-2"></i>Complete Setup</>
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary fw-semibold"
                      onClick={handleNext}
                      disabled={!canAdvance()}
                    >
                      Next<i className="fa-solid fa-arrow-right ms-2"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function TestResultBadge({ result }: { result: TestResult | null }) {
  if (!result) return null;
  return result.success ? (
    <div className="alert alert-success d-flex align-items-center gap-2 py-2 mt-3 mb-0">
      <i className="fa-solid fa-circle-check"></i>
      <span>Connection successful</span>
    </div>
  ) : (
    <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mt-3 mb-0">
      <i className="fa-solid fa-circle-xmark"></i>
      <span>{result.error || 'Connection failed'}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DatabaseStep({ form, testResult, testing, onTest }: { form: any; testResult: TestResult | null; testing: boolean; onTest: () => void }) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-database me-2 text-primary"></i>Database</h5>
      <p className="text-muted small mb-3">Enter your SQL Server connection string.</p>
      <div className="mb-3">
        <label className="form-label fw-medium">Connection String</label>
        <textarea
          className={`form-control font-monospace small${form.formState.errors.connectionString ? ' is-invalid' : ''}`}
          rows={3}
          placeholder="Server=localhost;Database=Kinetic;User Id=sa;Password=...;TrustServerCertificate=True"
          autoComplete="off"
          {...form.register('connectionString')}
        />
        {form.formState.errors.connectionString && (
          <div className="invalid-feedback">{form.formState.errors.connectionString.message}</div>
        )}
      </div>
      <button className="btn btn-outline-primary" onClick={onTest} disabled={testing}>
        {testing ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing...</> : <><i className="fa-solid fa-plug me-2"></i>Test Connection</>}
      </button>
      <TestResultBadge result={testResult} />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RabbitMqStep({ form, testResult, testing, onTest }: { form: any; testResult: TestResult | null; testing: boolean; onTest: () => void }) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-message me-2 text-primary"></i>Message Broker</h5>
      <p className="text-muted small mb-3">Enter your RabbitMQ connection string.</p>
      <div className="mb-3">
        <label className="form-label fw-medium">RabbitMQ Connection String</label>
        <input
          type="text"
          className={`form-control font-monospace small${form.formState.errors.connectionString ? ' is-invalid' : ''}`}
          placeholder="amqp://guest:guest@localhost:5672"
          autoComplete="off"
          {...form.register('connectionString')}
        />
        {form.formState.errors.connectionString && (
          <div className="invalid-feedback">{form.formState.errors.connectionString.message}</div>
        )}
      </div>
      <button className="btn btn-outline-primary" onClick={onTest} disabled={testing}>
        {testing ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing...</> : <><i className="fa-solid fa-plug me-2"></i>Test Connection</>}
      </button>
      <TestResultBadge result={testResult} />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RedisStep({ form, testResult, testing, onTest }: { form: any; testResult: TestResult | null; testing: boolean; onTest: () => void }) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-bolt me-2 text-primary"></i>Cache</h5>
      <p className="text-muted small mb-3">Enter your Redis connection string.</p>
      <div className="mb-3">
        <label className="form-label fw-medium">Redis Connection String</label>
        <input
          type="text"
          className={`form-control font-monospace small${form.formState.errors.connectionString ? ' is-invalid' : ''}`}
          placeholder="localhost:6379"
          autoComplete="off"
          {...form.register('connectionString')}
        />
        {form.formState.errors.connectionString && (
          <div className="invalid-feedback">{form.formState.errors.connectionString.message}</div>
        )}
      </div>
      <button className="btn btn-outline-primary" onClick={onTest} disabled={testing}>
        {testing ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing...</> : <><i className="fa-solid fa-plug me-2"></i>Test Connection</>}
      </button>
      <TestResultBadge result={testResult} />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SmtpStep({ form, testResult, testing, onTest }: { form: any; testResult: TestResult | null; testing: boolean; onTest: () => void }) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-envelope me-2 text-primary"></i>Email (Optional)</h5>
      <p className="text-muted small mb-3">
        Configure SMTP to enable password reset emails. You can skip this step and add it later.
      </p>
      <div className="row g-3">
        <div className="col-8">
          <label className="form-label fw-medium">SMTP Host</label>
          <input
            type="text"
            className="form-control"
            placeholder="smtp.example.com"
            {...form.register('host')}
          />
        </div>
        <div className="col-4">
          <label className="form-label fw-medium">Port</label>
          <input
            type="number"
            className="form-control"
            {...form.register('port', { valueAsNumber: true })}
          />
        </div>
        <div className="col-6">
          <label className="form-label fw-medium">Username</label>
          <input
            type="text"
            className="form-control"
            placeholder="user@example.com"
            autoComplete="off"
            {...form.register('username')}
          />
        </div>
        <div className="col-6">
          <label className="form-label fw-medium">Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="••••••••"
            autoComplete="new-password"
            {...form.register('password')}
          />
        </div>
        <div className="col-6">
          <label className="form-label fw-medium">From Address</label>
          <input
            type="email"
            className="form-control"
            placeholder="noreply@example.com"
            {...form.register('fromAddress')}
          />
        </div>
        <div className="col-6">
          <label className="form-label fw-medium">From Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Kinetic"
            {...form.register('fromName')}
          />
        </div>
        <div className="col-12">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="smtpUseSsl"
              {...form.register('useSsl')}
            />
            <label className="form-check-label small" htmlFor="smtpUseSsl">Use SSL/TLS</label>
          </div>
        </div>
      </div>
      {form.watch('host') && (
        <button className="btn btn-outline-primary mt-3" onClick={onTest} disabled={testing}>
          {testing ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending test...</> : <><i className="fa-solid fa-paper-plane me-2"></i>Send Test Email</>}
        </button>
      )}
      <TestResultBadge result={testResult} />
      {!form.watch('host') && (
        <div className="alert alert-info d-flex align-items-start gap-2 py-2 mt-3 mb-0">
          <i className="fa-solid fa-circle-info mt-1"></i>
          <span className="small">
            Without SMTP, password reset links will be shown directly in the browser (development mode).
            You can configure SMTP later in the config file.
          </span>
        </div>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecurityStep({ form }: { form: any }) {
  const [copied, setCopied] = useState(false);
  const key = form.watch('encryptionKey');

  const handleCopy = () => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    form.setValue('encryptionKey', generateEncryptionKey(), { shouldValidate: true });
  };

  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-shield-halved me-2 text-primary"></i>Security</h5>
      <p className="text-muted small mb-3">
        An encryption key is used to encrypt sensitive data like connection strings.
        A key has been auto-generated — save it somewhere secure.
      </p>
      <div className="mb-3">
        <label className="form-label fw-medium">Encryption Key</label>
        <div className="input-group">
          <input
            type="text"
            className={`form-control font-monospace small${form.formState.errors.encryptionKey ? ' is-invalid' : ''}`}
            {...form.register('encryptionKey')}
          />
          <button className="btn btn-outline-secondary" type="button" onClick={handleCopy} title="Copy">
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
          {form.formState.errors.encryptionKey && (
            <div className="invalid-feedback">{form.formState.errors.encryptionKey.message}</div>
          )}
        </div>
      </div>
      <button className="btn btn-outline-secondary btn-sm" onClick={handleRegenerate}>
        <i className="fa-solid fa-rotate me-1"></i>Regenerate
      </button>
      <div className="alert alert-warning d-flex align-items-start gap-2 py-2 mt-3 mb-0">
        <i className="fa-solid fa-triangle-exclamation mt-1"></i>
        <span className="small">Store this key securely. If you lose it, encrypted connection strings cannot be recovered.</span>
      </div>
    </>
  );
}

function AdminStep({ form, password, metCount, strengthColor, strengthLabel }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; password: string; metCount: number; strengthColor: string; strengthLabel: string;
}) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-user-shield me-2 text-primary"></i>Admin Account</h5>
      <p className="text-muted small mb-3">Create the initial administrator account.</p>

      <div className="mb-3">
        <label className="form-label fw-medium">Display Name</label>
        <div className="input-group has-validation">
          <span className="input-group-text bg-white"><i className="fa-solid fa-user text-muted"></i></span>
          <input
            type="text"
            className={`form-control${form.formState.errors.displayName ? ' is-invalid' : ''}`}
            placeholder="Jane Smith"
            autoComplete="off"
            {...form.register('displayName')}
          />
          {form.formState.errors.displayName && (
            <div className="invalid-feedback">{form.formState.errors.displayName.message}</div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label fw-medium">Email Address</label>
        <div className="input-group has-validation">
          <span className="input-group-text bg-white"><i className="fa-solid fa-envelope text-muted"></i></span>
          <input
            type="email"
            className={`form-control${form.formState.errors.email ? ' is-invalid' : ''}`}
            placeholder="admin@example.com"
            autoComplete="off"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <div className="invalid-feedback">{form.formState.errors.email.message}</div>
          )}
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label fw-medium">Password</label>
        <div className="input-group has-validation">
          <span className="input-group-text bg-white"><i className="fa-solid fa-lock text-muted"></i></span>
          <input
            type="password"
            className={`form-control${form.formState.errors.password ? ' is-invalid' : ''}`}
            placeholder="••••••••"
            autoComplete="new-password"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <div className="invalid-feedback">{form.formState.errors.password.message}</div>
          )}
        </div>
      </div>

      {password && (
        <div className="mb-3">
          <div className="d-flex gap-1 mb-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  height: 4, borderRadius: 2, flexGrow: 1,
                  background: i < metCount ? STRENGTH_BAR_COLOR[strengthColor] : '#dee2e6',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <div className={`small text-${strengthColor} fw-medium mb-1`}>{strengthLabel}</div>
          <div className="d-flex flex-wrap gap-2">
            {strengthCriteria.map(c => (
              <span key={c.label} className={`small ${c.test(password) ? 'text-success' : 'text-muted'}`}>
                <i className={`fa-solid ${c.test(password) ? 'fa-check' : 'fa-xmark'} me-1`}></i>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="form-label fw-medium">Confirm Password</label>
        <div className="input-group has-validation">
          <span className="input-group-text bg-white"><i className="fa-solid fa-lock text-muted"></i></span>
          <input
            type="password"
            className={`form-control${form.formState.errors.confirmPassword ? ' is-invalid' : ''}`}
            placeholder="••••••••"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword && (
            <div className="invalid-feedback">{form.formState.errors.confirmPassword.message}</div>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewStep({ db, rmq, redis, encKey, smtpHost, adminEmail, adminName }: {
  db: string; rmq: string; redis: string; encKey: string; smtpHost: string; adminEmail: string; adminName: string;
}) {
  return (
    <>
      <h5 className="fw-bold mb-1"><i className="fa-solid fa-clipboard-check me-2 text-primary"></i>Review</h5>
      <p className="text-muted small mb-3">Verify your settings before completing setup.</p>

      <table className="table table-sm mb-0">
        <tbody>
          <tr>
            <td className="fw-medium text-muted" style={{ width: '35%' }}>Database</td>
            <td className="font-monospace small text-break">{db}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">RabbitMQ</td>
            <td className="font-monospace small text-break">{rmq}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">Redis</td>
            <td className="font-monospace small text-break">{redis}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">Encryption Key</td>
            <td className="font-monospace small text-break">{encKey.slice(0, 8)}{'••••••••'}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">Email (SMTP)</td>
            <td className="small">{smtpHost ? <span className="text-success"><i className="fa-solid fa-check me-1"></i>{smtpHost}</span> : <span className="text-muted">Not configured</span>}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">Admin Name</td>
            <td>{adminName}</td>
          </tr>
          <tr>
            <td className="fw-medium text-muted">Admin Email</td>
            <td>{adminEmail}</td>
          </tr>
        </tbody>
      </table>

      <div className="alert alert-info d-flex align-items-start gap-2 py-2 mt-3 mb-0">
        <i className="fa-solid fa-circle-info mt-1"></i>
        <span className="small">
          Clicking <strong>Complete Setup</strong> will save the configuration, apply database migrations,
          and create your admin account. The application will restart automatically.
        </span>
      </div>
    </>
  );
}
