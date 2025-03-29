import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
});

const root = window.document.documentElement;

const getSystemTheme = (): 'dark' | 'light' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme !== null) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      console.warn('localStorage not available:', e);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return React.createElement(
    ThemeContext.Provider,
    { value: { isDarkMode, toggleTheme } },
    children
  );
};

export const useThemeContext = () => useContext(ThemeContext);

export const useTheme = useThemeContext;
