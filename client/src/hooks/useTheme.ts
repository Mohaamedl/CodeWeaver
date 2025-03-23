import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import React from 'react';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Try to get the theme from localStorage
    const savedTheme = localStorage.getItem('darkMode');
    
    // If there's a saved theme, use it
    if (savedTheme !== null) {
      return savedTheme === 'true';
    }
    
    // Otherwise, use the system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Update the document class when the theme changes
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save the theme preference to localStorage
    localStorage.setItem('darkMode', isDarkMode.toString());
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

export const useTheme = () => useContext(ThemeContext);
