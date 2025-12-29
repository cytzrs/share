import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard, Label } from '../components/ui';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// LLM Provider interface
interface LLMProvider {
  provider_id: string;
  name: string;
}

// Model Agent interface
interface ModelAgent {
  agent_id: string;
  name: string;
}

// LLM Request Log interface
interface LLMRequestLog {
  id: number;
  provider_id: string;
  provider_name: string | null;
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

// Filter configuration
interface FilterConfig {
  providerId: string;
  modelName: string;
  agentId: string;
  status: string;
}

// Pagination configuration
interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const LLMLogs: React.FC = () => {
  // State
  const [logs, setLogs] = useState<LLMRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter options
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<FilterConfig>({
    providerId: '',
    modelName: '',
    agentId: '',
    status: '',
  });
  
  // Pagination
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  
  // Expanded log
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Load providers and agents on mount
  useEffect(() => {
    loadProviders();
    loadAgents();
  }, []);
  
  // Load logs when filters or pagination change
  useEffect(() => {
    loadLogs();
  }, [filters, pagination.page, pagination.pageSize]);
  
  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/llm-providers`);
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error('加载渠道列表失败:', err);
    }
  };
  
  const loadAgents = async () => {
    try {
      const response = await fetch(`${API_BASE}/agents?page=1&page_size=100`);
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('加载Agent列表失败:', err);
    }
  };
  
  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
      });
      
      if (filters.providerId) params.append('provider_id', filters.providerId);
      if (filters.modelName) params.append('model_name', filters.modelName);
      if (filters.agentId) params.append('agent_id', filters.agentId);
      if (filters.status) params.append('status', filters.status);
      
      const response = await fetch(`${API_BASE}/llm-providers/logs/all?${params}`);
      const data = await response.json();
      
      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.total_pages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFilterChange = useCallback((key: keyof FilterConfig, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);
  
  const isValidJson = (str: string | null): boolean => {
    if (!str) return true;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">
        {/* Filters */}
        <GlassCard className="p-4 rounded-[7px]">
          <div className="flex flex-wrap items-end gap-4">
            {/* Provider Filter */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">API渠道</Label>
              <select
                value={filters.providerId}
                onChange={(e) => handleFilterChange('providerId', e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[140px]"
              >
                <option value="">全部渠道</option>
                {providers.map(provider => (
                  <option key={provider.provider_id} value={provider.provider_id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Model Name Filter */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">模型名称</Label>
              <input
                type="text"
                value={filters.modelName}
                onChange={(e) => handleFilterChange('modelName', e.target.value)}
                placeholder="搜索模型..."
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all w-40"
              />
            </div>
            
            {/* Agent Filter */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Agent</Label>
              <select
                value={filters.agentId}
                onChange={(e) => handleFilterChange('agentId', e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[140px]"
              >
                <option value="">全部Agent</option>
                {agents.map(agent => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Status Filter */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">状态</Label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[100px]"
              >
                <option value="">全部状态</option>
                <option value="success">成功</option>
                <option value="error">失败</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Logs Table */}
        <GlassCard className="p-6 rounded-[7px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200/40">
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">时间</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">渠道</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">模型</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">Agent</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">耗时</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">Token</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">状态</th>
                  <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      加载中...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      暂无日志记录
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <React.Fragment key={log.id}>
                      <tr className={`border-b border-gray-100/40 hover:bg-gray-50/50 transition-colors text-left ${index % 2 === 0 ? 'bg-white/20' : 'bg-gray-50/20'}`}>
                        <td className="py-3 px-3 text-left">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-gray-800">
                              {new Date(log.request_time).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(log.request_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-700 text-left">
                          {log.provider_name || log.provider_id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-left">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-600">
                            {log.model_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-700 text-left">
                          {log.agent_name || '-'}
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600 text-left">
                          {log.duration_ms}ms
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600 text-left">
                          {log.tokens_input || 0}/{log.tokens_output || 0}
                        </td>
                        <td className="py-3 px-3 text-left">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            log.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {log.status === 'success' ? '成功' : '失败'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left">
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-blue-500 text-xs hover:underline"
                          >
                            {expandedLogId === log.id ? '收起' : '详情'}
                          </button>
                        </td>
                      </tr>
                      {expandedLogId === log.id && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 bg-gray-50 text-left">
                            <div className="space-y-4">
                              {/* Request Content */}
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-2">请求内容</div>
                                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-[300px] whitespace-pre-wrap text-left">
                                  {log.request_content}
                                </pre>
                              </div>
                              {/* Response Content */}
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-2">
                                  响应内容
                                  {log.response_content && !isValidJson(log.response_content) && (
                                    <span className="text-red-500 ml-2">(非JSON格式)</span>
                                  )}
                                </div>
                                <pre className={`text-xs p-3 rounded border overflow-auto max-h-[300px] whitespace-pre-wrap text-left ${
                                  log.response_content && !isValidJson(log.response_content) ? 'bg-red-50 border-red-200' : 'bg-white'
                                }`}>
                                  {log.response_content || '(空)'}
                                </pre>
                              </div>
                              {/* Error Message */}
                              {log.error_message && (
                                <div>
                                  <div className="text-xs font-medium text-red-500 mb-2">错误信息</div>
                                  <pre className="text-xs bg-red-50 p-3 rounded border border-red-200 overflow-auto max-h-[100px] whitespace-pre-wrap text-red-600 text-left">
                                    {log.error_message}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-200/40 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                共 <span className="font-semibold text-gray-800">{pagination.total}</span> 条记录
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                          pagination.page === pageNum 
                            ? 'bg-gray-800 text-white' 
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default LLMLogs;
