/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSettings } from './useAdmin';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

type SiteSettings = {
  primaryColor?: string;
  heroGradientStart?: string;
  heroGradientEnd?: string;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  resolvedTheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();
  
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      return (stored as Theme) || 'light';
    }
    return 'light';
  });
  
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = (localStorage.getItem('theme') as Theme | null) || 'light';
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return stored;
  });

  const resolveTheme = useCallback((t: Theme): 'light' | 'dark' => {
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    const isDark = resolveTheme(t) === 'dark';
    const root = document.documentElement;
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    const nextResolvedTheme = isDark ? 'dark' : 'light';
    queueMicrotask(() => setResolvedTheme(nextResolvedTheme));
    localStorage.setItem('theme', t);
  }, [resolveTheme]);

  useEffect(() => {
    const currentTheme = theme;
    applyTheme(currentTheme);
  }, [theme, applyTheme]);



  useEffect(() => {
    if (settings) {
      const siteSettings = settings.find((s) => s.key === 'siteSettings')?.value as SiteSettings | undefined;
      if (siteSettings) {
        const primaryColor = siteSettings.primaryColor || '#eb6a3d';
        document.documentElement.style.setProperty('--color-primary-500', primaryColor);
        document.documentElement.style.setProperty('--color-primary-600', adjustBrightness(primaryColor, -15));
        document.documentElement.style.setProperty('--color-primary-400', adjustBrightness(primaryColor, 15));
        
        const heroGradientStart = siteSettings.heroGradientStart || '#fff7ed';
        const heroGradientEnd = siteSettings.heroGradientEnd || '#ffedd5';
        document.documentElement.style.setProperty('--hero-gradient-start', heroGradientStart);
        document.documentElement.style.setProperty('--hero-gradient-end', heroGradientEnd);
      }
    }
  }, [settings]);

  const handleSetTheme = (t: Theme) => {
    setTheme(t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export function useTheme() {
  return useContext(ThemeContext);
}
