import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, Label, StatusLabel, ModelIcon } from '../components/ui';
import { AgentFormModal } from '../components/agent';
import { agentApi, templateApi, llmProviderApi } from '../services/api';
import { useToast, useAuth } from '../contexts';
import { AgentListSkeleton } from '../components/common';
import type { 
  ModelAgent, 
  PromptTemplate, 
  CreateAgentRequest, 
  UpdateAgentRequest,
  LLMProvider,
  AgentStatus
} from '../types';

// Filter configuration
interface FilterConfig {
  name: string;
  modelName: string;
  providerId: string;
  status: string;
  hasPositions: string;  // '' | 'yes' | 'no'
}

/**
 * Agent管理页面
 * 以卡片列表形式展示所有Agent，支持创建、触发决策、暂停/恢复、删除操作
 */
const Agents: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterConfig>({
    name: '',
    modelName: '',
    providerId: '',
    status: '',
    hasPositions: '',
  });
  
  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ModelAgent | null>(null);
  
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  // Get unique model names from agents
  const modelNames = useMemo(() => {
    const names = new Set(agents.map(a => a.llm_model).filter(Boolean));
    return Array.from(names).sort();
  }, [agents]);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      // Name filter
      if (filters.name && !agent.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
      // Model name filter
      if (filters.modelName && agent.llm_model !== filters.modelName) {
        return false;
      }
      // Provider filter
      if (filters.providerId && agent.provider_id !== filters.providerId) {
        return false;
      }
      // Status filter
      if (filters.status && agent.status !== filters.status) {
        return false;
      }
      // Has positions filter
      if (filters.hasPositions === 'yes' && (agent.positions_count ?? 0) === 0) {
        return false;
      }
      if (filters.hasPositions === 'no' && (agent.positions_count ?? 0) > 0) {
        return false;
      }
      return true;
    });
  }, [agents, filters]);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof FilterConfig, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsResponse, templatesResponse, providersResponse] = await Promise.all([
        agentApi.list({ page: 1, page_size: 100 }),
        templateApi.list({ page: 1, page_size: 100 }),
        llmProviderApi.list(),
      ]);

      setAgents(agentsResponse.items);
      setTemplates(templatesResponse.items);
      setProviders(providersResponse as LLMProvider[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // ESC to close delete confirm
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmId) {
        setDeleteConfirmId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirmId]);

  // Handle create agent
  const handleCreateClick = useCallback(() => {
    setEditingAgent(null);
    setIsFormModalOpen(true);
  }, []);

  // Handle form submit
  const handleFormSubmit = useCallback(async (data: CreateAgentRequest | UpdateAgentRequest) => {
    if (editingAgent) {
      const updated = await agentApi.update(editingAgent.agent_id, data as UpdateAgentRequest);
      setAgents(prev => prev.map(a => a.agent_id === updated.agent_id ? updated : a));
    } else {
      const created = await agentApi.create(data as CreateAgentRequest);
      setAgents(prev => [...prev, created]);
    }
  }, [editingAgent]);

  // Handle trigger decision
  const handleTrigger = useCallback(async (agent: ModelAgent) => {
    const loadingKey = `trigger-${agent.agent_id}`;
    setLoadingAgents(prev => new Set(prev).add(loadingKey));
    try {
      const result = await agentApi.triggerDecision(agent.agent_id);
      if (result.success) {
        toast.success(result.message || '决策触发成功');
      } else {
        toast.error(result.error_message || '决策触发失败');
      }
      // Refresh agent data
      const updated = await agentApi.getById(agent.agent_id);
      setAgents(prev => prev.map(a => a.agent_id === updated.agent_id ? updated : a));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '触发失败');
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev);
        next.delete(loadingKey);
        return next;
      });
    }
  }, [toast]);

  // Handle pause/resume
  const handleToggleStatus = useCallback(async (agent: ModelAgent) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    const loadingKey = `status-${agent.agent_id}`;
    setLoadingAgents(prev => new Set(prev).add(loadingKey));
    try {
      const updated = await agentApi.update(agent.agent_id, { status: newStatus });
      setAgents(prev => prev.map(a => a.agent_id === updated.agent_id ? updated : a));
      toast.success(newStatus === 'paused' ? '已暂停' : '已恢复');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev);
        next.delete(loadingKey);
        return next;
      });
    }
  }, [toast]);

  // Handle delete
  const handleDelete = useCallback(async (agentId: string) => {
    const loadingKey = `delete-${agentId}`;
    setLoadingAgents(prev => new Set(prev).add(loadingKey));
    try {
      await agentApi.delete(agentId);
      setAgents(prev => prev.filter(a => a.agent_id !== agentId));
      setDeleteConfirmId(null);
      toast.success('删除成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev);
        next.delete(loadingKey);
        return next;
      });
    }
  }, [toast]);

  // Error state
  if (error && !loading) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center p-4">
        <GlassCard className="max-w-md p-6 rounded-[7px]">
          <div className="text-center">
            <div className="text-loss-red mb-4 text-lg font-semibold">加载失败</div>
            <p className="text-gray-500 mb-4">{error}</p>
            <button onClick={loadData} className="text-info-blue hover:underline font-medium">重试</button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <GlassCard className="p-4 rounded-[7px]">
        {/* Header with Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {/* Name Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Agent名称</Label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              placeholder="搜索名称..."
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all w-32"
            />
          </div>
          
          {/* Model Name Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">模型名称</Label>
            <select
              value={filters.modelName}
              onChange={(e) => handleFilterChange('modelName', e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[120px]"
            >
              <option value="">全部模型</option>
              {modelNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Provider Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">API渠道</Label>
            <select
              value={filters.providerId}
              onChange={(e) => handleFilterChange('providerId', e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[120px]"
            >
              <option value="">全部渠道</option>
              {providers.map(provider => (
                <option key={provider.provider_id} value={provider.provider_id}>
                  {provider.name}
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
              <option value="active">运行中</option>
              <option value="paused">已暂停</option>
            </select>
          </div>
          
          {/* Has Positions Filter */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">是否持仓</Label>
            <select
              value={filters.hasPositions}
              onChange={(e) => handleFilterChange('hasPositions', e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all min-w-[100px]"
            >
              <option value="">全部</option>
              <option value="yes">有持仓</option>
              <option value="no">无持仓</option>
            </select>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Create Button */}
          <button 
            onClick={handleCreateClick} 
            disabled={!isAuthenticated}
            className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
          >
            新建
          </button>
        </div>

        {/* Agent Grid */}
        {loading ? (
          <AgentListSkeleton />
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {agents.length === 0 ? '暂无Agent，点击上方按钮创建' : '没有符合筛选条件的Agent'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAgents.map(agent => (
              <AgentCardWithActions
                key={agent.agent_id}
                agent={agent}
                providers={providers}
                loadingAgents={loadingAgents}
                isAuthenticated={isAuthenticated}
                onTrigger={() => handleTrigger(agent)}
                onToggleStatus={() => handleToggleStatus(agent)}
                onDelete={() => setDeleteConfirmId(agent.agent_id)}
                onEdit={() => {
                  setEditingAgent(agent);
                  setIsFormModalOpen(true);
                }}
                onViewTransactions={() => navigate(`/transactions?agent_id=${agent.agent_id}`)}
                onCardClick={() => navigate(`/portfolio?agent_id=${agent.agent_id}`)}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Create/Edit Modal */}
      <AgentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingAgent(null);
        }}
        onSubmit={handleFormSubmit}
        agent={editingAgent}
        templates={templates}
        loading={loading}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-2xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要删除Agent "{agents.find(a => a.agent_id === deleteConfirmId)?.name}" 吗？
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={loadingAgents.has(`delete-${deleteConfirmId}`)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={loadingAgents.has(`delete-${deleteConfirmId}`)}
                className="px-3 py-1.5 text-xs rounded-lg font-bold text-white bg-loss-red hover:bg-loss-red/90"
              >
                {loadingAgents.has(`delete-${deleteConfirmId}`) ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Agent Card with Action Buttons
interface AgentCardWithActionsProps {
  agent: ModelAgent;
  providers: LLMProvider[];
  loadingAgents: Set<string>;
  isAuthenticated: boolean;
  onTrigger: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onViewTransactions: () => void;
  onCardClick: () => void;
}

// 根据字符串生成稳定的颜色
const getProviderColor = (name: string): { bg: string; text: string } => {
  const colors = [
    { bg: 'bg-blue-500/15', text: 'text-blue-600' },
    { bg: 'bg-purple-500/15', text: 'text-purple-600' },
    { bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
    { bg: 'bg-orange-500/15', text: 'text-orange-600' },
    { bg: 'bg-pink-500/15', text: 'text-pink-600' },
    { bg: 'bg-cyan-500/15', text: 'text-cyan-600' },
    { bg: 'bg-amber-500/15', text: 'text-amber-600' },
    { bg: 'bg-indigo-500/15', text: 'text-indigo-600' },
    { bg: 'bg-rose-500/15', text: 'text-rose-600' },
    { bg: 'bg-teal-500/15', text: 'text-teal-600' },
  ];
  
  // 使用字符串的哈希值来选择颜色
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
};

const AgentCardWithActions: React.FC<AgentCardWithActionsProps> = ({
  agent,
  providers,
  loadingAgents,
  isAuthenticated,
  onTrigger,
  onToggleStatus,
  onDelete,
  onEdit,
  onViewTransactions,
  onCardClick,
}) => {
  const totalAssets = agent.total_assets ?? agent.current_cash;
  const returnRate = agent.return_rate ?? (agent.initial_cash > 0 ? ((totalAssets - agent.initial_cash) / agent.initial_cash) * 100 : 0);
  
  const provider = providers.find(p => p.provider_id === agent.provider_id);
  const providerName = provider?.name || '未设置';
  
  const getStatusConfig = (status: AgentStatus): { label: string; statusType: 'profit' | 'loss' | 'neutral' | 'warning' } => {
    switch (status) {
      case 'active': return { label: '运行中', statusType: 'profit' };
      case 'paused': return { label: '已暂停', statusType: 'warning' };
      case 'deleted': return { label: '已删除', statusType: 'loss' };
      default: return { label: '未知', statusType: 'neutral' };
    }
  };

  const getScheduleLabel = (scheduleType: string): string => {
    switch (scheduleType) {
      case 'hourly': return '每小时';
      case 'daily': return '每日';
      case 'weekly': return '每周';
      case 'monthly': return '每月';
      case 'manual': return '手动';
      default: return scheduleType || '手动';
    }
  };

  const statusConfig = getStatusConfig(agent.status);
  const isTriggerLoading = loadingAgents.has(`trigger-${agent.agent_id}`);
  const isStatusLoading = loadingAgents.has(`status-${agent.agent_id}`);
  const isDeleteLoading = loadingAgents.has(`delete-${agent.agent_id}`);
  const isThisAgentLoading = isTriggerLoading || isStatusLoading || isDeleteLoading;

  return (
    <div 
      className="bg-white/60 rounded-[7px] p-4 border border-gray-100/60 hover:shadow-md transition-all cursor-pointer"
      onClick={onCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
          <ModelIcon modelName={agent.llm_model} size={20} />
          <h3 className="font-bold text-space-black truncate">{agent.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100/60 text-gray-500">
            {getScheduleLabel(agent.schedule_type)}
          </span>
          <StatusLabel status={statusConfig.statusType} className="text-[10px] px-1.5 py-0.5">
            {statusConfig.label}
          </StatusLabel>
        </div>
      </div>

      {/* Model info */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {(() => {
          const providerColor = getProviderColor(providerName);
          return (
            <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${providerColor.bg} ${providerColor.text}`}>
              {providerName}
            </span>
          );
        })()}
        <span className="px-1.5 py-0.5 rounded bg-gray-100/60 text-[10px] text-gray-600">{agent.llm_model}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
          (agent.positions_count ?? 0) > 0 
            ? 'bg-profit-green/15 text-profit-green' 
            : 'bg-gray-100/60 text-gray-500'
        }`}>
          持仓：{agent.positions_count ?? 0}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div>
          <div className="text-[9px] text-gray-600 uppercase">总资产/初始资金</div>
          <div className="font-semibold text-space-black">¥{totalAssets.toLocaleString()} / {agent.initial_cash.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-600 uppercase">收益率</div>
          <div className="font-semibold text-space-black">
            <span className={`text-sm font-bold ${returnRate >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
              {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100/60">
        {agent.status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); onTrigger(); }}
            disabled={isTriggerLoading || !isAuthenticated}
            title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-space-black text-white hover:bg-space-black/90 disabled:opacity-50 transition-colors"
          >
            {isTriggerLoading ? '触发中...' : '触发决策'}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
          disabled={isStatusLoading || !isAuthenticated}
          title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
          className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-colors disabled:opacity-50 ${
            agent.status === 'active' 
              ? 'bg-warning-orange/10 text-warning-orange hover:bg-warning-orange/20' 
              : 'bg-profit-green/10 text-profit-green hover:bg-profit-green/20'
          }`}
        >
          {isStatusLoading ? '...' : agent.status === 'active' ? '暂停' : '恢复'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={isThisAgentLoading || !isAuthenticated}
          title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
          className="px-2 py-1.5 text-[10px] font-medium rounded-lg bg-loss-red/10 text-loss-red hover:bg-loss-red/20 disabled:opacity-50 transition-colors"
        >
          删除
        </button>
      </div>
      
      {/* Edit & View Transactions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
          className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-info-blue/10 text-info-blue hover:bg-info-blue/20 disabled:opacity-50 transition-colors"
        >
          编辑
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onViewTransactions(); }}
          className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          交易记录({agent.transactions_count ?? 0}条)
        </button>
      </div>
    </div>
  );
};

export default Agents;
