import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface OrganizationBranding {
  id: string;
  organizationId: string;
  orgName: string;
  orgSlug: string;
  
  // Images
  logoUrl?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
  dashboardBackgroundUrl?: string;
  
  // Light theme colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMutedColor: string;
  borderColor: string;
  errorColor: string;
  warningColor: string;
  successColor: string;
  infoColor: string;
  
  // Dark theme colors
  darkPrimaryColor: string;
  darkSecondaryColor: string;
  darkAccentColor: string;
  darkBackgroundColor: string;
  darkSurfaceColor: string;
  darkTextColor: string;
  darkTextMutedColor: string;
  darkBorderColor: string;
  
  // Typography
  fontFamily: string;
  headingFontFamily: string;
  monoFontFamily: string;
  customCss?: string;
  
  // Settings
  allowLocalUsers: boolean;
  allowEntraId: boolean;
  requireMfa: boolean;
}

const defaultBranding: OrganizationBranding = {
  id: '',
  organizationId: '',
  orgName: 'Kinetic',
  orgSlug: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#6366F1',
  accentColor: '#10B981',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F8FAFC',
  textColor: '#1E293B',
  textMutedColor: '#64748B',
  borderColor: '#E2E8F0',
  errorColor: '#EF4444',
  warningColor: '#F59E0B',
  successColor: '#10B981',
  infoColor: '#3B82F6',
  darkPrimaryColor: '#60A5FA',
  darkSecondaryColor: '#818CF8',
  darkAccentColor: '#34D399',
  darkBackgroundColor: '#0F172A',
  darkSurfaceColor: '#1E293B',
  darkTextColor: '#F1F5F9',
  darkTextMutedColor: '#94A3B8',
  darkBorderColor: '#334155',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  monoFontFamily: 'JetBrains Mono, monospace',
  allowLocalUsers: true,
  allowEntraId: true,
  requireMfa: false,
};

interface BrandingState {
  branding: OrganizationBranding | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  isDarkMode: boolean;
  
  fetchBranding: (orgSlug: string) => Promise<void>;
  setBranding: (branding: OrganizationBranding) => void;
  clearBranding: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  
  // Computed theme values
  getThemeColors: () => {
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
  };
  
  getCssVariables: () => Record<string, string>;
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set, get) => ({
      branding: null,
      isLoaded: false,
      isLoading: false,
      error: null,
      isDarkMode: false,
      
      fetchBranding: async (orgSlug: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<OrganizationBranding>(`/api/organizations/slug/${orgSlug}/branding`);
          set({ 
            branding: response.data, 
            isLoaded: true, 
            isLoading: false 
          });
        } catch (err: any) {
          // Fall back to default branding if org not found
          set({ 
            branding: { ...defaultBranding, orgSlug },
            isLoaded: true, 
            isLoading: false,
            error: err.message 
          });
        }
      },
      
      setBranding: (branding) => {
        set({ branding, isLoaded: true });
      },
      
      clearBranding: () => {
        set({ branding: null, isLoaded: false });
      },
      
      toggleDarkMode: () => {
        set((state) => ({ isDarkMode: !state.isDarkMode }));
      },
      
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
      },
      
      getThemeColors: () => {
        const { branding, isDarkMode } = get();
        const b = branding || defaultBranding;
        
        if (isDarkMode) {
          return {
            primary: b.darkPrimaryColor,
            secondary: b.darkSecondaryColor,
            accent: b.darkAccentColor,
            background: b.darkBackgroundColor,
            surface: b.darkSurfaceColor,
            text: b.darkTextColor,
            textMuted: b.darkTextMutedColor,
            border: b.darkBorderColor,
            error: b.errorColor,
            warning: b.warningColor,
            success: b.successColor,
            info: b.infoColor,
          };
        }
        
        return {
          primary: b.primaryColor,
          secondary: b.secondaryColor,
          accent: b.accentColor,
          background: b.backgroundColor,
          surface: b.surfaceColor,
          text: b.textColor,
          textMuted: b.textMutedColor,
          border: b.borderColor,
          error: b.errorColor,
          warning: b.warningColor,
          success: b.successColor,
          info: b.infoColor,
        };
      },
      
      getCssVariables: () => {
        const colors = get().getThemeColors();
        const { branding } = get();
        const b = branding || defaultBranding;
        
        return {
          '--color-primary': colors.primary,
          '--color-secondary': colors.secondary,
          '--color-accent': colors.accent,
          '--color-background': colors.background,
          '--color-surface': colors.surface,
          '--color-text': colors.text,
          '--color-text-muted': colors.textMuted,
          '--color-border': colors.border,
          '--color-error': colors.error,
          '--color-warning': colors.warning,
          '--color-success': colors.success,
          '--color-info': colors.info,
          '--font-family': b.fontFamily,
          '--font-family-heading': b.headingFontFamily,
          '--font-family-mono': b.monoFontFamily,
        };
      },
    }),
    {
      name: 'kinetic-branding',
      partialize: (state) => ({ isDarkMode: state.isDarkMode }),
    }
  )
);
