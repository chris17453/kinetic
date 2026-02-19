import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';

interface OrgBranding {
  logoUrl?: string;
  loginBackgroundUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  allowLocalUsers: boolean;
  allowEntraId: boolean;
  orgName: string;
}

export function LoginPage() {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const navigate = useNavigate();
  const { login, loginWithEntra, isLoading, error, clearError } = useAuthStore();
  const { branding, fetchBranding, isLoaded } = useBrandingStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (orgSlug) {
      fetchBranding(orgSlug);
    }
  }, [orgSlug, fetchBranding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, orgSlug);
      navigate(orgSlug ? `/org/${orgSlug}` : '/');
    } catch {
      // Error is handled by store
    }
  };

  const handleEntraLogin = () => {
    loginWithEntra(orgSlug);
  };

  // Use org branding or defaults
  const theme = {
    primaryColor: branding?.primaryColor || '#3B82F6',
    secondaryColor: branding?.secondaryColor || '#6366F1',
    backgroundUrl: branding?.loginBackgroundUrl,
    logoUrl: branding?.logoUrl,
    fontFamily: branding?.fontFamily || 'Inter, system-ui, sans-serif',
    allowLocalUsers: branding?.allowLocalUsers ?? true,
    allowEntraId: branding?.allowEntraId ?? true,
    orgName: branding?.orgName || 'Kinetic',
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{ fontFamily: theme.fontFamily }}
    >
      {/* Background image or gradient */}
      {theme.backgroundUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${theme.backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ) : (
        <div 
          className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}20 0%, ${theme.secondaryColor}30 100%)`,
          }}
        />
      )}

      {/* Login card */}
      <div className="max-w-md w-full space-y-8 relative z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8">
        {/* Logo and title */}
        <div className="text-center">
          {theme.logoUrl ? (
            <img 
              src={theme.logoUrl} 
              alt={theme.orgName} 
              className="h-16 mx-auto mb-4"
            />
          ) : (
            <h1 
              className="text-4xl font-bold mb-2"
              style={{ color: theme.primaryColor }}
            >
              {theme.orgName}
            </h1>
          )}
          <h2 className="text-xl font-semibold text-gray-700">
            Sign in to your account
          </h2>
          {orgSlug && (
            <p className="text-sm text-gray-500 mt-1">
              Organization: <span className="font-medium">{theme.orgName}</span>
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative">
            <span>{error}</span>
            <button
              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
              onClick={clearError}
            >
              ×
            </button>
          </div>
        )}

        {/* Local login form */}
        {theme.allowLocalUsers && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm transition-all"
                style={{ 
                  '--tw-ring-color': theme.primaryColor,
                  borderColor: 'rgb(209 213 219)',
                } as React.CSSProperties}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 sm:text-sm transition-all"
                style={{ 
                  '--tw-ring-color': theme.primaryColor,
                } as React.CSSProperties}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  style={{ accentColor: theme.primaryColor }}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <Link 
                to="/forgot-password" 
                className="text-sm font-medium hover:underline"
                style={{ color: theme.primaryColor }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-all hover:opacity-90"
              style={{ 
                backgroundColor: theme.primaryColor,
                '--tw-ring-color': theme.primaryColor,
              } as React.CSSProperties}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        )}

        {/* Divider (show if both methods enabled) */}
        {theme.allowLocalUsers && theme.allowEntraId && (
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
        )}

        {/* Microsoft Entra login */}
        {theme.allowEntraId && (
          <button
            onClick={handleEntraLogin}
            className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
              <path d="M10 0H0V10H10V0Z" fill="#F25022" />
              <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
              <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
              <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </button>
        )}

        {/* Register link */}
        {theme.allowLocalUsers && (
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link 
              to={orgSlug ? `/org/${orgSlug}/register` : '/register'} 
              className="font-medium hover:underline"
              style={{ color: theme.primaryColor }}
            >
              Create an account
            </Link>
          </p>
        )}

        {/* Organization selector for root login */}
        {!orgSlug && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              Have an organization code?{' '}
              <Link 
                to="/org" 
                className="font-medium hover:underline"
                style={{ color: theme.secondaryColor }}
              >
                Enter organization
              </Link>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-sm text-gray-500/80">
          © {new Date().getFullYear()} Kinetic Reports. All rights reserved.
        </p>
      </div>
    </div>
  );
}
