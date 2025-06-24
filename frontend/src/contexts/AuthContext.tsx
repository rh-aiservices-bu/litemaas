import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, User } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  loginAsAdmin: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUser = async () => {
    try {
      // Check for admin bypass first
      const adminUser = localStorage.getItem('litemaas_admin_user');
      if (adminUser) {
        setUser(JSON.parse(adminUser));
        return;
      }

      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Check for admin bypass on error
      const adminUser = localStorage.getItem('litemaas_admin_user');
      if (adminUser) {
        setUser(JSON.parse(adminUser));
      } else {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // Check for admin bypass first
      const adminUser = localStorage.getItem('litemaas_admin_user');
      if (adminUser) {
        setUser(JSON.parse(adminUser));
        setLoading(false);
        return;
      }

      if (authService.isAuthenticated()) {
        await refreshUser();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const loginAsAdmin = () => {
    const adminUser: User = {
      id: 'admin-bypass',
      username: 'admin',
      email: 'admin@litemaas.local',
      name: 'Administrator (Test)',
      roles: ['admin', 'user'],
    };
    
    setUser(adminUser);
    localStorage.setItem('litemaas_admin_user', JSON.stringify(adminUser));
    navigate('/');
  };

  const logout = async () => {
    try {
      // Check if this is an admin bypass session
      const adminUser = localStorage.getItem('litemaas_admin_user');
      if (adminUser) {
        localStorage.removeItem('litemaas_admin_user');
        setUser(null);
        navigate('/login');
        return;
      }

      await authService.logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout on error
      localStorage.removeItem('litemaas_admin_user');
      setUser(null);
      navigate('/login');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginAsAdmin,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
