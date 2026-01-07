import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard, Label, SecondaryButton, StatusLabel } from '../components/ui';
import { StockDetailDrawer } from '../components/stock';
import { agentApi } from '../services/api';
import { TableSkeleton } from '../components/common';
import type { ModelAgent, Transaction } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// LLM Provider interface (for logs modal)
interface LLMProvider {
  provider_id: string;
  name: string;
}

// LLM Request Log interface
interface LLMRequestLog {
  id: number;
  provider_id: string;
  model_name: string;
  agent_id: string | null;
  agent_name?: string | null;  // 从provider logs接口返回时有此字段
  request_content: string;
  response_content: string | null;
  duration_ms: number;
  status: string;
  error_message: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  request_time: string;
}

// Extended transaction with agent info
interface TransactionWithAgent extends Transaction {
  agent_name?: string;
  llm_model?: string;
  provider_id?: string;
  provider_name?: string;
}

// Sort configuration interface
interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Filter configuration interface
interface FilterConfig {
  agentId: string;
  providerId: string;
  side: '' | 'buy' | 'sell';
  stockCode: string;
  startDate: string;
  endDate: string;
}

// Pagination configuration
interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 可展开的理由组件
const ExpandableReason: React.FC<{ reason: string; maxLength?: number }> = ({ reason, maxLength = 100 }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = reason.length > maxLength;
  
  if (!needsTruncate) {
    return <div className="whitespace-pre-wrap break-words">{reason}</div>;
  }
  
  return (
    <div className="whitespace-pre-wrap break-words">
      {expanded ? reason : `${reason.slice(0, maxLength)}...`}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-blue-500 hover:text-blue-700 text-xs font-medium"
      >
        {expanded ? '收起' : '展开'}
      </button>
    </div>
  );
};

/**
 * Transactions页面 - 交易记录
 * 展示交易记录表格，支持筛选、分页和导出功能
 */
const Transactions: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // State for stock detail drawer
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(null);
  
  // State for agents
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  
  // State for transactions
  const [transactions, setTransactions] = useState<TransactionWithAgent[]>([]);
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'executed_at', direction: 'desc' });
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // State for filtering
  const [filters, setFilters] = useState<FilterConfig>({
    agentId: '',
    providerId: '',
    side: '',
    stockCode: '',
    startDate: today,
    endDate: today,
  });
  
  // State for providers list
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  
  // State for transaction LLM log drawer
  const [selectedTxForLog, setSelectedTxForLog] = useState<TransactionWithAgent | null>(null);
  const [txLlmLog, setTxLlmLog] = useState<LLMRequestLog | null>(null);
  const [txLogsLoading, setTxLogsLoading] = useState(false);
  
  // State for logs modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsProvider, setLogsProvider] = useState<LLMProvider | null>(null);
  const [logs, setLogs] = useState<LLMRequestLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  
  // State for pagination
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // ESC 关闭日志弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLogsModal) {
        setShowLogsModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLogsModal]);

  // Load agents on mount
  useEffect(() => {
    loadAgents();
    loadProviders();
  }, []);

  // Load transactions when filters or pagination change
  useEffect(() => {
    if (agents.length > 0) {
      loadTransactions();
    }
  }, [agents, filters.agentId, filters.providerId, filters.side, filters.startDate, filters.endDate, pagination.page, pagination.pageSize]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await agentApi.list({ page: 1, page_size: 100, include_transactions: true });
      setAgents(response.items);
      
      // Check URL param for agent_id, otherwise default to all agents (empty string)
      const urlAgentId = searchParams.get('agent_id');
      if (urlAgentId && response.items.some(a => a.agent_id === urlAgentId)) {
        setFilters(prev => ({ ...prev, agentId: urlAgentId }));
      }
      // Default is already empty string (all agents), no need to set
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载Agent列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // Load providers list
  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/llm-providers`);
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error('加载渠道列表失败:', err);
    }
  };
  
  // Load LLM log for a specific transaction
  const loadTxLogs = async (tx: TransactionWithAgent) => {
    setSelectedTxForLog(tx);
    setTxLogsLoading(true);
    setTxLlmLog(null);
    
    try {
      // 通过交易记录ID获取关联的LLM请求日志
      // portfolio路由挂载在/agents下
      const response = await fetch(
        `${API_BASE}/agents/transactions/${tx.tx_id}/llm-log`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTxLlmLog(data);
      } else if (response.status === 404) {
        // 没有关联的LLM日志
        setTxLlmLog(null);
      } else {
        console.error('加载LLM日志失败:', response.statusText);
      }
    } catch (err) {
      console.error('加载LLM日志失败:', err);
    } finally {
      setTxLogsLoading(false);
    }
  };
  
  // Load logs for a provider
  const loadLogs = async (providerId: string, page: number = 1) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/llm-providers/${providerId}/logs?page=${page}&page_size=20`);
      const data = await response.json();
      setLogs(data.logs);
      setLogsTotal(data.total);
      setLogsTotalPages(data.total_pages);
      setLogsPage(page);
    } catch (err) {
      console.error('加载日志失败:', err);
    } finally {
      setLogsLoading(false);
    }
  };
  
  // Open logs modal for a provider
  const openLogsModal = (providerId: string, providerName: string) => {
    setLogsProvider({ provider_id: providerId, name: providerName });
    setShowLogsModal(true);
    setExpandedLogId(null);
    loadLogs(providerId, 1);
  };
  
  // Format time helper
  const formatTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  // Check if string is valid JSON
  const isValidJson = (str: string | null): boolean => {
    if (!str) return true;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // 从 agents 中获取交易记录（已在 loadAgents 时加载）
      let allTransactions: TransactionWithAgent[] = [];
      
      // 如果选择了特定Agent，只显示该Agent的交易记录
      const targetAgents = filters.agentId 
        ? agents.filter(a => a.agent_id === filters.agentId)
        : agents;
      
      for (const agent of targetAgents) {
        if (agent.transactions) {
          const txWithAgent = agent.transactions.map(tx => ({
            ...tx,
            agent_name: agent.name,
            llm_model: agent.llm_model,
            provider_id: agent.provider_id,
            provider_name: agent.provider_name,
          }));
          allTransactions.push(...txWithAgent);
        }
      }
      
      // 按方向筛选
      if (filters.side) {
        allTransactions = allTransactions.filter(tx => tx.side === filters.side);
      }
      
      // 按渠道筛选
      if (filters.providerId) {
        allTransactions = allTransactions.filter(tx => tx.provider_id === filters.providerId);
      }
      
      // 按日期筛选
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        allTransactions = allTransactions.filter(tx => new Date(tx.executed_at) >= startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        allTransactions = allTransactions.filter(tx => new Date(tx.executed_at) <= endDate);
      }
      
      // 按时间排序
      allTransactions.sort((a, b) => 
        new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
      );
      
      // 客户端分页
      const total = allTransactions.length;
      const totalPages = Math.ceil(total / pagination.pageSize);
      const startIndex = (pagination.page - 1) * pagination.pageSize;
      const paginatedTransactions = allTransactions.slice(startIndex, startIndex + pagination.pageSize);
      
      setTransactions(paginatedTransactions);
      setPagination(prev => ({
        ...prev,
        total,
        totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载交易记录失败');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    
    // Apply stock code filter (client-side)
    if (filters.stockCode) {
      result = result.filter(tx => 
        tx.stock_code?.toLowerCase().includes(filters.stockCode.toLowerCase())
      );
    }
    
    // Apply sort
    result.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof Transaction];
      const bValue = b[sortConfig.key as keyof Transaction];
      
      if (sortConfig.key === 'executed_at') {
        const aTime = new Date(aValue as string).getTime();
        const bTime = new Date(bValue as string).getTime();
        return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
    
    return result;
  }, [transactions, filters.stockCode, sortConfig]);

  // Handle sort
  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof FilterConfig, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (key !== 'stockCode') {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, []);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ['交易ID', '订单ID', '股票代码', '方向', '数量', '价格', '成交金额', '佣金', '印花税', '过户费', '总费用', '成交时间'];
    const rows = filteredTransactions.map(tx => [
      tx.tx_id,
      tx.order_id,
      tx.stock_code,
      tx.side === 'buy' ? '买入' : '卖出',
      tx.quantity,
      tx.price.toFixed(2),
      (tx.price * tx.quantity).toFixed(2),
      (tx.fees?.commission ?? 0).toFixed(2),
      (tx.fees?.stamp_tax ?? 0).toFixed(2),
      (tx.fees?.transfer_fee ?? 0).toFixed(2),
      (tx.fees?.total ?? 0).toFixed(2),
      new Date(tx.executed_at).toLocaleString('zh-CN'),
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${filters.agentId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredTransactions, filters.agentId]);

  // Format helpers
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Get sort indicator
  const getSortIndicator = (key: string): string => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Table columns configuration
  const columns = [
    { key: 'tx_id', label: 'ID', sortable: false, width: 'w-16' },
    { key: 'executed_at', label: '交易时间', sortable: true },
    { key: 'agent_name', label: 'Agent', sortable: true },
    { key: 'provider_name', label: 'API渠道', sortable: true },
    { key: 'llm_model', label: '实际模型', sortable: true },
    { key: 'stock_code', label: '股票代码', sortable: true },
    { key: 'side', label: '方向', sortable: true },
    { key: 'quantity', label: '数量', sortable: true },
    { key: 'price', label: '价格', sortable: true },
    { key: 'amount', label: '成交金额', sortable: false },
    { key: 'fees', label: '费用', sortable: false },
    { key: 'reason', label: '交易理由', sortable: false },
  ];

  // Loading state
  if (loading && agents.length === 0) {
    return (
      <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
        <div className="space-y-4">
          <div className="bg-white/60 rounded-[7px] p-4">
            <div className="flex flex-wrap items-end gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <TableSkeleton rows={10} cols={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">
        {/* Filters */}
        <GlassCard className="p-4 rounded-[7px]">
          <div className="flex flex-wrap items-end gap-4">
            {/* Agent Selector */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">选择Agent</Label>
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

            {/* Side Filter */}
            <div className="flex flex-col gap-1">
              <Label>交易方向</Label>
              <select
                value={filters.side}
                onChange={(e) => handleFilterChange('side', e.target.value)}
                className="px-4 py-2 rounded-xl bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[120px]"
              >
                <option value="">全部</option>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            </div>

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

            {/* Stock Code Filter */}
            <div className="flex flex-col gap-1.5">
              <Label>股票代码</Label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.stockCode}
                  onChange={(e) => handleFilterChange('stockCode', e.target.value)}
                  placeholder="搜索股票代码..."
                  className="pl-8 pr-4 py-2 text-sm rounded-xl bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all w-40"
                />
                <svg 
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1.5">
              <Label>开始日期</Label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="px-4 py-2 text-sm rounded-xl bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>结束日期</Label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="px-4 py-2 text-sm rounded-xl bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all"
              />
            </div>

            {/* Export Button */}
            {/* <SecondaryButton
              onClick={handleExport}
              className="px-4 py-2 text-sm rounded-xl"
              disabled={filteredTransactions.length === 0}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出CSV
              </span>
            </SecondaryButton> */}
          </div>
        </GlassCard>

        {/* Error Message */}
        {error && (
          <div className="bg-loss-red/10 text-loss-red px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Transactions Table */}
        <GlassCard className="p-6 rounded-[7px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200/40">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`
                        py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-left
                        ${col.sortable ? 'cursor-pointer hover:text-space-black transition-colors' : ''}
                      `}
                    >
                      {col.label}{col.sortable ? getSortIndicator(col.key) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-gray-400">
                      加载中...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-gray-400">
                      暂无交易记录
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, index) => (
                    <tr 
                      key={tx.tx_id}
                      className={`
                        border-b border-gray-100/40 
                        hover:bg-gray-50/50 transition-colors text-left
                        ${index % 2 === 0 ? 'bg-white/20' : 'bg-gray-50/20'}
                      `}
                    >
                      {/* ID */}
                      <td className="py-3 px-2">
                        <button
                          onClick={() => loadTxLogs(tx)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono"
                          title="点击查看接口日志"
                        >
                          #{tx.tx_id.slice(0, 6)}
                        </button>
                      </td>
                      
                      {/* Executed At */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-gray-800">
                            {new Date(tx.executed_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(tx.executed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      
                      {/* Agent Name */}
                      <td className="py-3 px-3 text-sm text-gray-700">
                        {tx.agent_name || '-'}
                      </td>
                      
                      {/* Provider Name */}
                      <td className="py-3 px-3 text-sm text-gray-700">
                        {tx.provider_name || <span className="text-gray-400">-</span>}
                      </td>
                      
                      {/* LLM Model */}
                      <td className="py-3 px-2 text-sm text-gray-500 max-w-[200px]">
                        {tx.llm_model ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-block break-all ${getModelColor(tx.llm_model).bg} ${getModelColor(tx.llm_model).text}`}>
                            {tx.llm_model}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Stock Code */}
                      <td className="py-3 px-3 min-w-[140px]">
                        {tx.stock_code ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSelectedStockCode(tx.stock_code)}
                                className="font-semibold text-sm text-gray-800 hover:text-blue-600 cursor-pointer"
                              >
                                {tx.stock_code}
                              </button>
                              <StockBadge code={tx.stock_code} />
                            </div>
                            {tx.stock_name && (
                              <span className="text-xs text-gray-400 truncate max-w-[120px]" title={tx.stock_name}>
                                {tx.stock_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Side */}
                      <td className="py-3 px-3">
                        <StatusLabel 
                          status={tx.side === 'buy' ? 'loss' : tx.side === 'sell' ? 'profit' : 'neutral'}
                          className="text-xs"
                        >
                          {tx.side === 'buy' ? '买入' : tx.side === 'sell' ? '卖出' : '观望'}
                        </StatusLabel>
                      </td>
                      
                      {/* Quantity */}
                      <td className="py-3 px-3 font-medium">
                        {tx.quantity != null ? tx.quantity.toLocaleString() : '-'}
                      </td>
                      
                      {/* Price */}
                      <td className="py-3 px-3">
                        {tx.price != null ? `¥${formatCurrency(tx.price)}` : '-'}
                      </td>
                      
                      {/* Amount */}
                      <td className="py-3 px-3 font-medium">
                        {tx.price != null && tx.quantity != null ? `¥${formatCurrency(tx.price * tx.quantity)}` : '-'}
                      </td>
                      
                      {/* Fees */}
                      <td className="py-3 px-3">
                        <div className="group relative">
                          <span className="text-gray-500 cursor-help">
                            ¥{formatCurrency(tx.fees?.total ?? 0)}
                          </span>
                          {/* Tooltip */}
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
                            <div className="bg-space-black text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg text-left">
                              <div className="flex justify-between gap-4">
                                <span>佣金:</span>
                                <span>¥{formatCurrency(tx.fees?.commission ?? 0)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>印花税:</span>
                                <span>¥{formatCurrency(tx.fees?.stamp_tax ?? 0)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>过户费:</span>
                                <span>¥{formatCurrency(tx.fees?.transfer_fee ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Reason */}
                      <td className="py-3 px-2 text-sm text-gray-600 max-w-[180px]">
                        {tx.reason ? (
                          <ExpandableReason reason={tx.reason} maxLength={35} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-200/40 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                共 <span className="font-semibold text-space-black">{pagination.total}</span> 条记录
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
                        className={`
                          w-8 h-8 text-sm rounded-lg transition-colors
                          ${pagination.page === pageNum 
                            ? 'bg-space-black text-white' 
                            : 'bg-gray-100 hover:bg-gray-200'
                          }
                        `}
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

          {/* Summary Footer */}
          {filteredTransactions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200/40 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-500">
                  买入: <span className="font-semibold text-loss-red">
                    {filteredTransactions.filter(tx => tx.side === 'buy').length} 笔
                  </span>
                </span>
                <span className="text-gray-500">
                  卖出: <span className="font-semibold text-profit-green">
                    {filteredTransactions.filter(tx => tx.side === 'sell').length} 笔
                  </span>
                </span>
                <span className="text-gray-500">
                  观望: <span className="font-semibold text-profit-green">
                    {filteredTransactions.filter(tx => tx.side === 'hold').length} 笔
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500">
                  总成交金额: <span className="font-semibold text-space-black">
                    ¥{formatCurrency(filteredTransactions.reduce((sum, tx) => sum + tx.price * tx.quantity, 0))}
                  </span>
                </span>
                <span className="text-gray-500">
                  总费用: <span className="font-semibold text-space-black">
                    ¥{formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (tx.fees?.total ?? 0), 0))}
                  </span>
                </span>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* 股票详情抽屉 */}
      <StockDetailDrawer 
        stockCode={selectedStockCode} 
        onClose={() => setSelectedStockCode(null)} 
      />

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
                              <button onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="text-blue-500 text-xs hover:underline flex-shrink-0">
                                {expandedLogId === log.id ? '收起' : '展开'}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {log.response_content ? (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs truncate ${!isValidJson(log.response_content) ? 'text-red-500' : 'text-gray-600'}`}>
                                  {log.response_content.slice(0, 50)}...
                                </span>
                                {!isValidJson(log.response_content) && <span className="text-xs text-red-500">(非JSON)</span>}
                              </div>
                            ) : <span className="text-xs text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{log.duration_ms}ms</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {log.status === 'success' ? '成功' : '失败'}
                            </span>
                            {log.error_message && <div className="text-xs text-red-500 mt-1 truncate max-w-[100px]" title={log.error_message}>{log.error_message}</div>}
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
                                  <Label className="text-xs mb-1 block">响应内容 {!isValidJson(log.response_content) && <span className="text-red-500">(非JSON格式)</span>}</Label>
                                  <pre className={`text-xs p-3 rounded border overflow-auto max-h-[200px] whitespace-pre-wrap text-left ${!isValidJson(log.response_content) ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                                    {log.response_content || '(空)'}
                                  </pre>
                                </div>
                                {log.error_message && (
                                  <div>
                                    <Label className="text-xs mb-1 block text-red-500">错误信息</Label>
                                    <pre className="text-xs bg-red-50 p-3 rounded border border-red-200 overflow-auto max-h-[100px] whitespace-pre-wrap text-red-500">{log.error_message}</pre>
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

      {/* Transaction LLM Log Drawer */}
      {selectedTxForLog && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="flex-1 bg-black/30" 
            onClick={() => setSelectedTxForLog(null)}
          />
          
          {/* Drawer */}
          <div className="w-[700px] bg-white shadow-2xl flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">LLM接口日志</h2>
                <p className="text-sm text-gray-500">
                  #{selectedTxForLog.tx_id.slice(0, 8)} · {selectedTxForLog.stock_code || '观望'} · {selectedTxForLog.side === 'buy' ? '买入' : selectedTxForLog.side === 'sell' ? '卖出' : '观望'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTxForLog(null)} 
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Transaction Info */}
            <div className="p-4 border-b bg-blue-50/50">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Agent:</span>
                  <span className="ml-2 font-medium">{selectedTxForLog.agent_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">渠道:</span>
                  <span className="ml-2 font-medium">{selectedTxForLog.provider_name || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">模型:</span>
                  <span className="ml-2 font-medium">{selectedTxForLog.llm_model}</span>
                </div>
                <div>
                  <span className="text-gray-500">交易时间:</span>
                  <span className="ml-2 font-medium">{formatTime(selectedTxForLog.executed_at)}</span>
                </div>
              </div>
            </div>
            
            {/* LLM Log Content */}
            <div className="flex-1 overflow-auto p-4">
              {txLogsLoading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : !txLlmLog ? (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>未找到关联的LLM请求日志</p>
                  <p className="text-xs mt-1">该交易记录可能是历史数据，没有关联LLM日志</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    {/* Log Header */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          txLlmLog.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {txLlmLog.status === 'success' ? '成功' : '失败'}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(txLlmLog.request_time)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{txLlmLog.duration_ms}ms</span>
                        <span>·</span>
                        <span>{txLlmLog.tokens_input || 0}/{txLlmLog.tokens_output || 0} tokens</span>
                      </div>
                    </div>
                    
                    {/* Request */}
                    <div className="p-3 border-b">
                      <div className="text-xs font-medium text-gray-500 mb-2">请求内容</div>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-[400px] whitespace-pre-wrap text-left">{txLlmLog.request_content}</pre>
                    </div>
                    
                    {/* Response */}
                    <div className="p-3">
                      <div className="text-xs font-medium text-gray-500 mb-2">
                        响应内容
                        {txLlmLog.response_content && !isValidJson(txLlmLog.response_content) && (
                          <span className="text-red-500 ml-2">(非JSON格式)</span>
                        )}
                      </div>
                      <pre className={`text-xs p-2 rounded overflow-auto max-h-[500px] whitespace-pre-wrap text-left ${
                        txLlmLog.response_content && !isValidJson(txLlmLog.response_content) ? 'bg-red-50' : 'bg-gray-50'
                      }`}>
                        {txLlmLog.response_content || '(空)'}
                      </pre>
                    </div>
                    
                    {/* Error */}
                    {txLlmLog.error_message && (
                      <div className="p-3 bg-red-50 border-t border-red-100">
                        <div className="text-xs font-medium text-red-500 mb-2">错误信息</div>
                        <pre className="text-xs text-red-600 whitespace-pre-wrap">{txLlmLog.error_message}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;

// 根据字符串生成稳定的颜色
const getModelColor = (name: string): { bg: string; text: string } => {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-600' },
    { bg: 'bg-purple-100', text: 'text-purple-600' },
    { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { bg: 'bg-orange-100', text: 'text-orange-600' },
    { bg: 'bg-pink-100', text: 'text-pink-600' },
    { bg: 'bg-cyan-100', text: 'text-cyan-600' },
    { bg: 'bg-amber-100', text: 'text-amber-600' },
    { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    { bg: 'bg-rose-100', text: 'text-rose-600' },
    { bg: 'bg-teal-100', text: 'text-teal-600' },
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Stock badge component to show board type
 */
const StockBadge: React.FC<{ code: string }> = ({ code }) => {
  let label = '';
  let colorClass = '';
  
  if (code.startsWith('688')) {
    label = '科创';
    colorClass = 'bg-purple-100 text-purple-600';
  } else if (code.startsWith('300') || code.startsWith('301')) {
    label = '创业';
    colorClass = 'bg-orange-100 text-orange-600';
  } else if (code.startsWith('60')) {
    label = '沪A';
    colorClass = 'bg-blue-100 text-blue-600';
  } else if (code.startsWith('00')) {
    label = '深A';
    colorClass = 'bg-green-100 text-green-600';
  }
  
  if (!label) return null;
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
      {label}
    </span>
  );
};
