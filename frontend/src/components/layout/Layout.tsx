import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, useAuth, useToast } from '../../contexts';
import { agentApi } from '../../services/api';
import { AIChatWidget } from '../ai';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', path: '/dashboard', label: '仪表盘', icon: <DashboardIcon /> },
  { id: 'agents', path: '/agents', label: 'Agent管理', icon: <AgentIcon /> },
  { id: 'transactions', path: '/transactions', label: '交易记录', icon: <TransactionIcon /> },
  { id: 'market', path: '/market', label: '股市行情', icon: <MarketIcon /> },
  { id: 'mcp', path: '/mcp', label: 'MCP市场', icon: <MCPIcon /> },
  { id: 'templates', path: '/templates', label: '提示词模板', icon: <TemplateIcon /> },
  { id: 'compare', path: '/compare', label: '模型对比', icon: <CompareIcon /> },
  { id: 'providers', path: '/providers', label: '模型渠道', icon: <ProviderIcon /> },
  { id: 'llm-logs', path: '/llm-logs', label: '接口日志', icon: <LogIcon /> },
  { id: 'settings', path: '/settings', label: '系统管理', icon: <SettingsIcon /> },
];

/**
 * 主布局组件 - 包含侧边导航栏和顶部工具栏
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, authEnabled, login, logout } = useAuth();
  const toast = useToast();

  // 获取当前页面ID
  const currentPage = navItems.find(item => 
    location.pathname === item.path || 
    (item.path === '/dashboard' && location.pathname === '/')
  )?.id || 'dashboard';

  // 触发所有Agent决策
  const handleTriggerAll = useCallback(async () => {
    if (triggerLoading || !isAuthenticated) return;
    
    setTriggerLoading(true);
    
    try {
      const result = await agentApi.triggerAllDecisions();
      toast.success(result.message || '触发成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '触发失败');
    } finally {
      setTriggerLoading(false);
    }
  }, [triggerLoading, isAuthenticated, toast]);

  // 处理登录
  const handleLogin = useCallback(async () => {
    if (!loginKey.trim()) {
      setLoginError('请输入管理员密钥');
      return;
    }
    
    setLoginLoading(true);
    setLoginError('');
    
    try {
      const success = await login(loginKey);
      if (success) {
        setShowLoginModal(false);
        setLoginKey('');
        toast.success('登录成功');
      } else {
        setLoginError('密钥错误');
      }
    } catch {
      setLoginError('登录失败');
    } finally {
      setLoginLoading(false);
    }
  }, [loginKey, login, toast]);

  // 处理登出
  const handleLogout = useCallback(async () => {
    await logout();
    toast.info('已退出登录');
  }, [logout, toast]);

  // ESC 键关闭登录弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLoginModal) {
        setShowLoginModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showLoginModal]);

  return (
    <div className={`h-screen flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-ios-gray'}`}>
      {/* Sidebar */}
      <aside 
        className={`
          ${theme === 'dark' ? 'bg-gray-800/90 border-gray-700/60' : 'bg-white/80 border-gray-200/60'}
          backdrop-blur-xl border-r
          flex flex-col transition-all duration-300 h-full
          ${collapsed ? 'w-16' : 'w-56'}
        `}
      >
        {/* Logo */}
        <div className={`h-14 flex items-center justify-center border-b ${theme === 'dark' ? 'border-gray-700/40' : 'border-gray-200/40'} px-4`}>
          {collapsed ? (
            <span className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-space-black'}`}>Q</span>
          ) : (
            <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-space-black'}`}>AI交易竞技场</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems
            .filter(item => {
              return true;
            })
            .map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                transition-all duration-150 cursor-pointer
                ${currentPage === item.id 
                  ? theme === 'dark' 
                    ? 'bg-white text-gray-900 shadow-md' 
                    : 'bg-space-black text-white shadow-md'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700/50'
                    : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Disclaimer */}
        {!collapsed && (
          <div className={`px-3 py-2 mx-2 mb-2 rounded-lg text-[10px] leading-relaxed ${
            theme === 'dark' ? 'bg-gray-700/30 text-gray-400' : 'bg-gray-100/60 text-gray-500'
          }`}>
            <span className="font-medium">免责声明：</span>本站仅提供AI模拟交易数据展示，不构成任何投资建议。
          </div>
        )}

        {/* Login/Logout Button */}
        {authEnabled && (
          <div className={`p-2 border-t ${theme === 'dark' ? 'border-gray-700/40' : 'border-gray-200/40'}`}>
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'text-green-400 hover:bg-gray-700/50' 
                    : 'text-green-600 hover:bg-gray-100'
                }`}
              >
                <span className="w-5 h-5 flex-shrink-0"><LogoutIcon /></span>
                {!collapsed && <span className="text-sm font-medium">已登录 · 登出</span>}
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'text-yellow-400 hover:bg-gray-700/50' 
                    : 'text-yellow-600 hover:bg-gray-100'
                }`}
              >
                <span className="w-5 h-5 flex-shrink-0"><LoginIcon /></span>
                {!collapsed && <span className="text-sm font-medium">管理员登录</span>}
              </button>
            )}
          </div>
        )}

        {/* Collapse Toggle */}
        <div className={`p-2 border-t ${theme === 'dark' ? 'border-gray-700/40' : 'border-gray-200/40'}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'text-gray-400 hover:bg-gray-700/50' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className={`h-12 flex items-center justify-end gap-3 px-4 border-b ${
          theme === 'dark' ? 'bg-gray-800/90 border-gray-700/40' : 'bg-white/80 border-gray-200/40'
        } backdrop-blur-xl`}>
          {/* Auth Status Indicator */}
          {authEnabled && !isAuthenticated && (
            <div className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              只读模式
            </div>
          )}
          
          {/* Donate Button */}
          <a
            href="https://credit.linux.do/paying/online?token=2d1109a417673496e57d39286bac00c6cf0612a1606251dd8853f47e68a0c2dc"
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 hover:scale-105 ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg hover:shadow-pink-500/25'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white shadow-lg hover:shadow-pink-500/25'
            }`}
          >
            <span className="text-sm animate-bounce">👍</span>
            <span>使用Linux DO Credit打赏</span>
          </a>
          
          {/* Trigger All Button */}
          <button
            onClick={handleTriggerAll}
            disabled={triggerLoading || !isAuthenticated}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              triggerLoading || !isAuthenticated
                ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
                : theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-info-blue hover:bg-blue-600 text-white'
            }`}
            title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
          >
            {triggerLoading ? (
              <LoadingSpinner />
            ) : (
              <PlayIcon />
            )}
            <span>{triggerLoading ? '执行中...' : '主动触发全部Agent'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            // onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-yellow-400 hover:bg-gray-700/50' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        {/* Main Content */}
        <main className={`flex-1 overflow-auto ${theme === 'dark' ? 'bg-gray-900' : ''}`}>
          {children}
        </main>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLoginModal(false)} />
          <div className={`relative w-full max-w-sm rounded-xl shadow-2xl p-6 ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h2 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              管理员登录
            </h2>
            
            {loginError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                管理员密钥
              </label>
              <input
                type="password"
                value={loginKey}
                onChange={(e) => setLoginKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="请输入管理员密钥"
                className={`w-full px-4 py-2.5 rounded-lg border outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500'
                }`}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loginLoading ? '登录中...' : '登录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Widget */}
      <AIChatWidget />
    </div>
  );
};

export default Layout;

// Icons
function DashboardIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function TransactionIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ProviderIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function MCPIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
