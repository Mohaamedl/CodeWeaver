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
  githubAccessToken: string | null;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  githubAccessToken: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [githubAccessToken, setGithubAccessToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
      setGithubAccessToken(null);
      localStorage.removeItem('github_token');
      localStorage.removeItem('userId');
    };

    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);

        const storedToken = localStorage.getItem('github_token');
        if (storedToken) {
          const response = await fetch('/api/auth/status', {
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          const data = await response.json();
          console.log('Auth status:', data);

          if (data.authenticated) {
            setIsAuthenticated(true);
            setGithubAccessToken(data.githubAccessToken);
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
        setGithubAccessToken(data.accessToken);
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
      setGithubAccessToken(null);
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
    { value: { isAuthenticated, user, isLoading, githubAccessToken, login, logout } },
    children
  );
};

export const useAuth = () => useContext(AuthContext);
