import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard, Label } from '../components/ui';
import { useToast, useAuth } from '../contexts';

interface LLMProvider {
  provider_id: string;
  name: string;
  protocol: string;
  api_url: string;
  api_key_masked: string;
  is_active: boolean;
  log_count: number;
  created_at: string;
  updated_at: string;
}

interface LLMModel {
  id: string;
  name: string;
}

interface LLMRequestLog {
  id: number;
  provider_id: string;
  model_name: string;
  agent_id: string | null;
  agent_name: string | null;
  request_content: string;
  response_content: string | null;
  duration_ms: number;
  status: string;
  error_message: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  request_time: string;
}

interface LogsResponse {
  logs: LLMRequestLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PROTOCOLS = [
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com' },
  { value: 'gemini', label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta' },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'admin_token';

// 带认证的 fetch
const authFetch = (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

const Settings: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [formData, setFormData] = useState({ name: '', protocol: 'openai', api_url: 'https://api.openai.com/v1', api_key: '' });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  
  // 日志弹窗状态
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsProvider, setLogsProvider] = useState<LLMProvider | null>(null);
  const [logs, setLogs] = useState<LLMRequestLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  
  // 模型列表弹窗状态
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [modelsProvider, setModelsProvider] = useState<LLMProvider | null>(null);
  const [modelsList, setModelsList] = useState<LLMModel[]>([]);
  const [modelsListLoading, setModelsListLoading] = useState(false);
  
  // 筛选状态
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  // ESC 键关闭弹窗
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showModelsModal) setShowModelsModal(false);
      else if (showLogsModal) setShowLogsModal(false);
      else if (showForm) resetForm();
    }
  }, [showModelsModal, showLogsModal, showForm]);

  useEffect(() => {
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleEsc]);

  useEffect(() => { loadProviders(); }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/llm-providers`);
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      toast.error('加载渠道列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProtocolChange = (protocol: string) => {
    const protocolConfig = PROTOCOLS.find(p => p.value === protocol);
    setFormData(prev => ({ ...prev, protocol, api_url: protocolConfig?.defaultUrl || prev.api_url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingProvider ? `${API_BASE}/llm-providers/${editingProvider.provider_id}` : `${API_BASE}/llm-providers`;
      const method = editingProvider ? 'PUT' : 'POST';
      const body: Record<string, unknown> = { name: formData.name, protocol: formData.protocol, api_url: formData.api_url };
      if (formData.api_key) body.api_key = formData.api_key;

      const response = await authFetch(url, { method, body: JSON.stringify(body) });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.detail?.message || '保存失败');
      }

      await loadProviders();
      resetForm();
      toast.success(editingProvider ? '渠道已更新' : '渠道已创建');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setFormData({ name: provider.name, protocol: provider.protocol, api_url: provider.api_url, api_key: '' });
    setShowForm(true);
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm('确定要删除这个渠道吗？')) return;
    try {
      const response = await authFetch(`${API_BASE}/llm-providers/${providerId}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) {
        const err = await response.json();
        throw new Error(err.message || err.detail?.message || '删除失败');
      }
      await loadProviders();
      toast.success('渠道已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleActive = async (provider: LLMProvider) => {
    const newStatus = !provider.is_active;
    const action = newStatus ? '启用' : '停用';
    
    if (!newStatus) {
      if (!confirm(`确定要停用渠道"${provider.name}"吗？\n停用后，使用该渠道的Agent将被暂停。`)) return;
    }
    
    try {
      const response = await authFetch(`${API_BASE}/llm-providers/${provider.provider_id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: newStatus }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.detail?.message || `${action}失败`);
      }
      
      await loadProviders();
      toast.success(`渠道已${action}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action}失败`);
    }
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE}/llm-providers/${providerId}/test`, { method: 'POST' });
      const result = await response.json();
      setTestResult({ id: providerId, ...result });
      if (result.success) toast.success('连接测试成功');
      else toast.error(result.message || '连接测试失败');
    } catch {
      setTestResult({ id: providerId, success: false, message: '测试失败' });
      toast.error('测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleLoadModels = async (provider: LLMProvider) => {
    setModelsProvider(provider);
    setShowModelsModal(true);
    setModelsListLoading(true);
    setModelsList([]);
    try {
      const response = await fetch(`${API_BASE}/llm-providers/${provider.provider_id}/models`);
      if (!response.ok) {
        throw new Error('加载失败');
      }
      const models = await response.json();
      setModelsList(Array.isArray(models) ? models : []);
    } catch {
      toast.error('加载模型列表失败');
      setModelsList([]);
    } finally {
      setModelsListLoading(false);
    }
  };

  const handleViewLogs = async (provider: LLMProvider) => {
    setLogsProvider(provider);
    setShowLogsModal(true);
    setLogsPage(1);
    await loadLogs(provider.provider_id, 1);
  };

  const loadLogs = async (providerId: string, page: number) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/llm-providers/${providerId}/logs?page=${page}&page_size=20`);
      const data: LogsResponse = await response.json();
      setLogs(data.logs);
      setLogsTotalPages(data.total_pages);
      setLogsTotal(data.total);
      setLogsPage(page);
    } catch {
      toast.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProvider(null);
    setFormData({ name: '', protocol: 'openai', api_url: 'https://api.openai.com/v1', api_key: '' });
  };

  const isValidJson = (str: string | null): boolean => {
    if (!str) return false;
    try { JSON.parse(str); return true; } catch { return false; }
  };

  const formatTime = (time: string) => new Date(time).toLocaleString('zh-CN');
  
  const formatDate = (time: string) => new Date(time).toLocaleDateString('zh-CN');

  // 筛选后的渠道列表
  const filteredProviders = providers.filter(provider => {
    const matchName = !filterName || provider.name.toLowerCase().includes(filterName.toLowerCase());
    const matchStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && provider.is_active) || 
      (filterStatus === 'inactive' && !provider.is_active);
    return matchName && matchStatus;
  });

  if (loading) {
    return <div className="h-full bg-ios-gray flex items-center justify-center"><div className="text-gray-500">加载中...</div></div>;
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">

        {/* Provider Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold mb-4 text-gray-900">{editingProvider ? '编辑渠道' : '添加渠道'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="text-xs font-semibold text-gray-700">渠道名称</label><input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="例如：OpenAI官方" required className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900" /></div>
                <div><label className="text-xs font-semibold text-gray-700">协议类型</label><select value={formData.protocol} onChange={e => handleProtocolChange(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2 bg-white">{PROTOCOLS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-gray-700">API地址</label><input value={formData.api_url} onChange={e => setFormData(prev => ({ ...prev, api_url: e.target.value }))} required className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900" /></div>
                <div><label className="text-xs font-semibold text-gray-700">{editingProvider ? 'API密钥（留空不修改）' : 'API密钥'}</label><input type="password" value={formData.api_key} onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))} placeholder="sk-..." required={!editingProvider} className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
                  <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-space-black text-white rounded-lg hover:bg-graphite disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Providers List */}
        <GlassCard className="p-4 rounded-[7px]">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-xs">模型渠道</Label>
            <span className="text-[10px] text-gray-400">{filteredProviders.length} / {providers.length} 个</span>
          </div>
          
          {/* 筛选栏 */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="搜索渠道名称..."
              className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 border-none outline-none focus:ring-2 focus:ring-info-blue/20"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 border-none outline-none focus:ring-2 focus:ring-info-blue/20 cursor-pointer"
            >
              <option value="all">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已禁用</option>
            </select>
            <button 
              onClick={() => setShowForm(true)}
              disabled={!isAuthenticated}
              title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
              className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              新建
            </button>
          </div>
          
          {filteredProviders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{providers.length === 0 ? '暂无LLM渠道配置' : '没有匹配的渠道'}</p>
              <p className="text-gray-400 text-sm mt-1">{providers.length === 0 ? '点击"添加渠道"开始配置' : '请调整筛选条件'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase">
                    <th className="pb-2 font-medium">名称</th>
                    <th className="pb-2 font-medium">协议</th>
                    <th className="pb-2 font-medium">API地址</th>
                    <th className="pb-2 font-medium">状态</th>
                    <th className="pb-2 font-medium">创建时间</th>
                    <th className="pb-2 font-medium">日志</th>
                    <th className="pb-2 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProviders.map(provider => (
                    <tr key={provider.provider_id} className="hover:bg-white/30 transition-colors">
                      <td className="py-3">
                        <div className="font-medium text-space-black">{provider.name}</div>
                        {testResult?.id === provider.provider_id && (
                          <div className={`text-xs mt-0.5 ${testResult.success ? 'text-profit-green' : 'text-loss-red'}`}>
                            {testResult.message}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-info-blue/10 text-info-blue">
                          {PROTOCOLS.find(p => p.value === provider.protocol)?.label || provider.protocol}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-gray-500 font-mono truncate block max-w-[200px]" title={provider.api_url}>
                          {provider.api_url}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${provider.is_active ? 'bg-profit-green/10 text-profit-green' : 'bg-gray-200 text-gray-500'}`}>
                          {provider.is_active ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-gray-500">{formatTime(provider.created_at)}</span>
                      </td>
                      <td className="py-3">
                        <button 
                          onClick={() => handleViewLogs(provider)} 
                          className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          {provider.log_count} 条
                        </button>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleToggleActive(provider)}
                            disabled={!isAuthenticated}
                            title={!isAuthenticated ? '需要登录' : (provider.is_active ? '停用渠道' : '启用渠道')}
                            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              provider.is_active 
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {provider.is_active ? '停用' : '启用'}
                          </button>
                          <button 
                            disabled={!isAuthenticated} 
                            onClick={() => handleLoadModels(provider)} 
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            获取模型
                          </button>
                          <button 
                            onClick={() => handleTest(provider.provider_id)} 
                            disabled={testingId === provider.provider_id || !isAuthenticated} 
                            title={!isAuthenticated ? '需要登录' : ''} 
                            className="px-2 py-1 text-xs rounded bg-info-blue/10 text-info-blue hover:bg-info-blue/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingId === provider.provider_id ? '...' : '测试'}
                          </button>
                          <button 
                            onClick={() => handleEdit(provider)} 
                            disabled={!isAuthenticated} 
                            title={!isAuthenticated ? '需要登录' : ''} 
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            编辑
                          </button>
                          <button 
                            onClick={() => handleDelete(provider.provider_id)} 
                            disabled={!isAuthenticated} 
                            title={!isAuthenticated ? '需要登录' : ''} 
                            className="px-2 py-1 text-xs rounded bg-loss-red/10 text-loss-red hover:bg-loss-red/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Logs Modal */}
        {showLogsModal && logsProvider && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">接口日志 - {logsProvider.name}</h2>
                  <p className="text-sm text-gray-500">共 {logsTotal} 条记录</p>
                </div>
                <button onClick={() => setShowLogsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {logsLoading ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无日志记录</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">模型</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Agent</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">请求内容</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">响应内容</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">耗时</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Token</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map(log => (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-gray-50 text-left">
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{formatTime(log.request_time)}</td>
                            <td className="px-3 py-2 text-xs font-mono">{log.model_name}</td>
                            <td className="px-3 py-2 text-xs">{log.agent_name || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px]">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-600 truncate">{log.request_content.slice(0, 50)}...</span>
                                <button onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="text-info-blue text-xs hover:underline flex-shrink-0">
                                  {expandedLogId === log.id ? '收起' : '展开'}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 max-w-[200px]">
                              {log.response_content ? (
                                <div className="flex items-center gap-1">
                                  <span className={`text-xs truncate ${!isValidJson(log.response_content) ? 'text-loss-red' : 'text-gray-600'}`}>
                                    {log.response_content.slice(0, 50)}...
                                  </span>
                                  {!isValidJson(log.response_content) && <span className="text-xs text-loss-red">(非JSON)</span>}
                                </div>
                              ) : <span className="text-xs text-gray-400">-</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{log.duration_ms}ms</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${log.status === 'success' ? 'bg-profit-green/10 text-profit-green' : 'bg-loss-red/10 text-loss-red'}`}>
                                {log.status === 'success' ? '成功' : '失败'}
                              </span>
                              {log.error_message && <div className="text-xs text-loss-red mt-1 truncate max-w-[100px]" title={log.error_message}>{log.error_message}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                              {log.tokens_input || 0}/{log.tokens_output || 0}
                            </td>
                          </tr>
                          {expandedLogId === log.id && (
                            <tr>
                              <td colSpan={8} className="px-3 py-3 bg-gray-50">
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-xs mb-1 block">请求内容</Label>
                                    <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-[200px] whitespace-pre-wrap text-left">{log.request_content}</pre>
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1 block">响应内容 {!isValidJson(log.response_content) && <span className="text-loss-red">(非JSON格式)</span>}</Label>
                                    <pre className={`text-xs p-3 rounded border overflow-auto max-h-[200px] whitespace-pre-wrap text-left ${!isValidJson(log.response_content) ? 'bg-loss-red/5 border-loss-red/20' : 'bg-white'}`}>
                                      {log.response_content || '(空)'}
                                    </pre>
                                  </div>
                                  {log.error_message && (
                                    <div>
                                      <Label className="text-xs mb-1 block text-loss-red">错误信息</Label>
                                      <pre className="text-xs bg-loss-red/5 p-3 rounded border border-loss-red/20 overflow-auto max-h-[100px] whitespace-pre-wrap text-loss-red">{log.error_message}</pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <span className="text-sm text-gray-500">第 {logsPage} / {logsTotalPages} 页</span>
                  <div className="flex gap-2">
                    <button onClick={() => loadLogs(logsProvider.provider_id, logsPage - 1)} disabled={logsPage <= 1 || logsLoading} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50">上一页</button>
                    <button onClick={() => loadLogs(logsProvider.provider_id, logsPage + 1)} disabled={logsPage >= logsTotalPages || logsLoading} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50">下一页</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Models Modal */}
        {showModelsModal && modelsProvider && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">模型列表 - {modelsProvider.name}</h2>
                  <p className="text-sm text-gray-500">
                    {modelsListLoading ? '加载中...' : `共 ${modelsList.length} 个模型`}
                  </p>
                </div>
                <button onClick={() => setShowModelsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {modelsListLoading ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : modelsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无可用模型</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {modelsList.map((model, index) => (
                      <div 
                        key={model.id} 
                        className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-xs text-gray-400 w-5 flex-shrink-0">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-gray-900 truncate" title={model.name || model.id}>
                            {model.name || model.id}
                          </div>
                          {model.name && model.name !== model.id && (
                            <div className="text-[10px] text-gray-500 font-mono truncate" title={model.id}>{model.id}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
