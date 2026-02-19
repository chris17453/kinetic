import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface BrandingColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

interface Branding {
  logoUrl?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
  dashboardBackgroundUrl?: string;
  light: BrandingColors;
  dark: BrandingColors;
  fontFamily: string;
  headingFontFamily: string;
  monoFontFamily: string;
  customCss?: string;
}

interface ThemeContextType {
  mode: 'light' | 'dark' | 'system';
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  resolvedMode: 'light' | 'dark';
  branding: Branding;
  setBranding: (branding: Branding) => void;
  colors: BrandingColors;
  logo: string | undefined;
}

const defaultLightColors: BrandingColors = {
  primary: '#3B82F6',
  secondary: '#6366F1',
  accent: '#10B981',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
};

const defaultDarkColors: BrandingColors = {
  primary: '#60A5FA',
  secondary: '#818CF8',
  accent: '#34D399',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#334155',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
};

const defaultBranding: Branding = {
  light: defaultLightColors,
  dark: defaultDarkColors,
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  monoFontFamily: 'JetBrains Mono, monospace',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme-mode');
    return (saved as 'light' | 'dark' | 'system') || 'system';
  });
  
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Save mode preference
  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const resolvedMode = mode === 'system' ? systemMode : mode;
  const colors = resolvedMode === 'dark' ? branding.dark : branding.light;
  const logo = resolvedMode === 'dark' 
    ? (branding.logoLightUrl || branding.logoUrl) 
    : (branding.logoDarkUrl || branding.logoUrl);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    // Colors
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-info', colors.info);
    
    // Typography
    root.style.setProperty('--font-family', branding.fontFamily);
    root.style.setProperty('--font-heading', branding.headingFontFamily);
    root.style.setProperty('--font-mono', branding.monoFontFamily);
    
    // Apply dark mode class
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Update favicon
    if (branding.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = branding.faviconUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [colors, branding, resolvedMode]);

  // Apply custom CSS
  useEffect(() => {
    const styleId = 'kinetic-custom-css';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (branding.customCss) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.customCss;
    } else if (styleEl) {
      styleEl.remove();
    }
  }, [branding.customCss]);

  return (
    <ThemeContext.Provider value={{
      mode,
      setMode,
      resolvedMode,
      branding,
      setBranding,
      colors,
      logo,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to fetch and apply org branding
export function useOrgBranding(orgId?: string) {
  const { setBranding } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`/api/organizations/${orgId}/branding`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load branding');
        return res.json();
      })
      .then(data => {
        setBranding({
          logoUrl: data.logoUrl,
          logoLightUrl: data.logoLightUrl,
          logoDarkUrl: data.logoDarkUrl,
          faviconUrl: data.faviconUrl,
          loginBackgroundUrl: data.loginBackgroundUrl,
          dashboardBackgroundUrl: data.dashboardBackgroundUrl,
          light: {
            primary: data.primaryColor,
            secondary: data.secondaryColor,
            accent: data.accentColor,
            background: data.backgroundColor,
            surface: data.surfaceColor,
            text: data.textColor,
            textMuted: data.textMutedColor,
            border: data.borderColor,
            error: data.errorColor,
            warning: data.warningColor,
            success: data.successColor,
            info: data.infoColor,
          },
          dark: {
            primary: data.darkPrimaryColor,
            secondary: data.darkSecondaryColor,
            accent: data.darkAccentColor,
            background: data.darkBackgroundColor,
            surface: data.darkSurfaceColor,
            text: data.darkTextColor,
            textMuted: data.darkTextMutedColor,
            border: data.darkBorderColor,
            error: data.errorColor,
            warning: data.warningColor,
            success: data.successColor,
            info: data.infoColor,
          },
          fontFamily: data.fontFamily,
          headingFontFamily: data.headingFontFamily,
          monoFontFamily: data.monoFontFamily,
          customCss: data.customCss,
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [orgId, setBranding]);

  return { loading, error };
}

// Theme toggle component
export function ThemeToggle() {
  const { mode, setMode, resolvedMode } = useTheme();
  
  const nextMode = () => {
    if (mode === 'light') return 'dark';
    if (mode === 'dark') return 'system';
    return 'light';
  };
  
  const icon = resolvedMode === 'dark' ? '🌙' : '☀️';
  const label = mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light';
  
  return (
    <button
      onClick={() => setMode(nextMode())}
      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface transition-colors"
      title={`Current: ${label}. Click to change.`}
    >
      <span>{icon}</span>
      <span className="text-sm capitalize">{label}</span>
    </button>
  );
}
