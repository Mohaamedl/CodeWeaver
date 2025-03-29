import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type User = {
  id: number;
  username: string;
  githubUsername?: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);

        // Check URL params first
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const userId = params.get('userId');

        if (urlToken) {
          console.log('Found token in URL, storing...');
          localStorage.setItem('github_token', urlToken);
          if (userId) {
            localStorage.setItem('userId', userId);
          }
          window.history.replaceState(null, '', window.location.pathname);
        }

        const storedToken = localStorage.getItem('github_token');
        
        // Only proceed with auth check if we have a token
        if (storedToken) {
          const response = await fetch('/api/auth/status', {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });

          const data = await response.json();
          console.log('Auth status:', data);

          if (data.authenticated) {
            setIsAuthenticated(true);
            if (data.githubAccessToken && data.githubAccessToken !== storedToken) {
              localStorage.setItem('github_token', data.githubAccessToken);
            }
            setUser({
              id: data.userId,
              username: data.username || 'User',
              githubUsername: data.githubUsername,
            });
          } else {
            handleLogout();
          }
        } else {
          handleLogout();
        }
      } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };

    const handleLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('github_token');
      localStorage.removeItem('userId');
    };

    // Check auth status on mount
    checkAuthStatus();
    
    // Also check when URL changes - this helps refresh auth state after redirect
    const handleUrlChange = () => {
      checkAuthStatus();
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleGitHubCallback = async (code: string) => {
    try {
      const response = await fetch('/api/auth/github/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem('github_token', data.accessToken);
        setIsAuthenticated(true);
        setUser({
          id: data.userId,
          username: data.username || 'User',
          githubUsername: data.githubUsername,
        });
      }
    } catch (error) {
      console.error('GitHub authentication error:', error);
    }
  };

  const login = () => {
    window.location.href = '/api/auth/github';
  };

  const logout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      setIsAuthenticated(false);
      setUser(null);
      queryClient.clear();
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out',
      });
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: 'Logout failed',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { isAuthenticated, user, isLoading, login, logout } },
    children
  );
};

export const useAuth = () => useContext(AuthContext);
