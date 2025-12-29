import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, AUTH_ERROR_EVENT } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  authEnabled: boolean;
  loading: boolean;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'admin_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const status = await authApi.getStatus();
      setAuthEnabled(status.auth_enabled);
      setIsAuthenticated(status.is_authenticated);
    } catch (err) {
      console.error('检查认证状态失败:', err);
      // 如果检查失败，假设未启用认证
      setAuthEnabled(false);
      setIsAuthenticated(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 登录
  const login = useCallback(async (secretKey: string): Promise<boolean> => {
    try {
      const result = await authApi.login(secretKey);
      if (result.success && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('登录失败:', err);
      return false;
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('登出失败:', err);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setIsAuthenticated(false);
    }
  }, []);

  // 监听 TOKEN_EXPIRED 事件
  useEffect(() => {
    const handleAuthError = () => {
      setIsAuthenticated(false);
    };
    
    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);
    return () => {
      window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
    };
  }, []);

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authEnabled,
        loading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 获取存储的token
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export default AuthContext;
