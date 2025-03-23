import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import React from 'react';

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
        const response = await fetch('/api/auth/status', {
          credentials: 'include',
        });
        
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        
        if (data.authenticated && data.userId) {
          setUser({
            id: data.userId,
            username: data.username || 'User',
            githubUsername: data.githubUsername,
          });
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

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
