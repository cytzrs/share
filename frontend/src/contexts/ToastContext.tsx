import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AUTH_ERROR_EVENT } from '../services/api';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${++idCounter.current}`;
    setToasts(prev => [...prev, { id, type, message }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((message: string) => showToast('success', message), [showToast]);
  const error = useCallback((message: string) => showToast('error', message, 5000), [showToast]);
  const warning = useCallback((message: string) => showToast('warning', message, 4000), [showToast]);
  const info = useCallback((message: string) => showToast('info', message), [showToast]);

  // 监听 TOKEN_EXPIRED 事件，显示 toast 提示
  useEffect(() => {
    const handleAuthError = (event: CustomEvent<{ message: string }>) => {
      error(event.detail?.message || '登录已过期，请重新登录');
    };
    
    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError as EventListener);
    return () => {
      window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError as EventListener);
    };
  }, [error]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast 容器组件
const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

// 单个 Toast 组件
const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const config = {
    success: {
      bg: 'bg-white',
      icon: (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ),
    },
    error: {
      bg: 'bg-white',
      icon: (
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ),
    },
    warning: {
      bg: 'bg-white',
      icon: (
        <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
      ),
    },
    info: {
      bg: 'bg-white',
      icon: (
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
      ),
    },
  };

  const { bg, icon } = config[toast.type];

  return (
    <div
      className={`${bg} px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[200px] max-w-[360px] animate-slide-in pointer-events-auto`}
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      {icon}
      <span className="text-sm text-gray-800 font-medium">{toast.message}</span>
    </div>
  );
};

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);
