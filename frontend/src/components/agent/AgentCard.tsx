import React from 'react';
import { StatusLabel, ModelIcon } from '../ui';
import type { ModelAgent, AgentStatus, LLMProvider } from '../../types';

interface AgentCardProps {
  agent: ModelAgent;
  isSelected?: boolean;
  onClick?: () => void;
  providers?: LLMProvider[];
  compact?: boolean;
}

/**
 * Agent卡片组件
 * 以卡片形式展示单个Agent的信息和状态
 */
export const AgentCard: React.FC<AgentCardProps> = ({ agent, isSelected, onClick, providers = [], compact = false }) => {
  // 使用API返回的总资产，如果没有则使用当前现金
  const totalAssets = agent.total_assets ?? agent.current_cash;
  // 使用API返回的实时收益率，如果没有则基于总资产计算
  const returnRate = agent.return_rate ?? (agent.initial_cash > 0 ? ((totalAssets - agent.initial_cash) / agent.initial_cash) * 100 : 0);
  
  // Find provider name
  const provider = providers.find(p => p.provider_id === agent.provider_id);
  const providerName = provider?.name || '未设置';
  
  const getStatusConfig = (status: AgentStatus): { label: string; statusType: 'profit' | 'loss' | 'neutral' | 'warning' | 'info' } => {
    switch (status) {
      case 'active':
        return { label: '运行中', statusType: 'profit' };
      case 'paused':
        return { label: '已暂停', statusType: 'warning' };
      case 'deleted':
        return { label: '已删除', statusType: 'loss' };
      default:
        return { label: '未知', statusType: 'neutral' };
    }
  };

  const statusConfig = getStatusConfig(agent.status);

  // Compact mode for grid layout
  if (compact) {
    return (
      <div 
        className={`
          bg-white/60 rounded-lg p-3 border transition-all duration-200
          ${isSelected 
            ? 'border-space-black/30 ring-2 ring-space-black/10 shadow-md' 
            : 'border-gray-100/60 hover:shadow-sm hover:bg-white/80'
          }
          ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        `}
        onClick={onClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            <span className="flex-shrink-0"><ModelIcon modelName={agent.llm_model} size={18} /></span>
            <h3 className="font-semibold text-space-black truncate text-sm">{agent.name}</h3>
          </div>
          <StatusLabel status={statusConfig.statusType} className="text-[10px] px-1.5 py-0.5">
            {statusConfig.label}
          </StatusLabel>
        </div>

        {/* Model info */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100/60 text-[10px] text-gray-600">
            {agent.llm_model}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">¥{totalAssets.toLocaleString()}</span>
          <span className={`font-semibold ${returnRate >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
            {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        bg-white/60 rounded-[7px] p-5 border transition-all duration-200
        ${isSelected 
          ? 'border-space-black/30 ring-2 ring-space-black/10 shadow-lg' 
          : 'border-gray-100/60 hover:shadow-md hover:bg-white/80'
        }
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      {/* Header with name and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0"><ModelIcon modelName={agent.llm_model} size={22} /></span>
            <h3 className="font-bold text-space-black truncate text-lg">{agent.name}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{agent.agent_id.slice(0, 8)}...</p>
        </div>
        <StatusLabel status={statusConfig.statusType}>
          {statusConfig.label}
        </StatusLabel>
      </div>

      {/* Model and Schedule info */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-info-blue/10 text-xs text-info-blue">
          {providerName}
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100/60 text-xs text-gray-600">
          {agent.llm_model}
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100/60 text-xs text-gray-600">
          {agent.schedule_type === 'daily' ? '每日' : agent.schedule_type === 'hourly' ? '每小时' : agent.schedule_type}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100/60">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">初始资金</div>
          <div className="text-sm font-semibold text-space-black">
            ¥{agent.initial_cash.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">当前现金</div>
          <div className="text-sm font-semibold text-space-black">
            ¥{agent.current_cash.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Return Rate */}
      <div className="mt-3 pt-3 border-t border-gray-100/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-400">收益率</span>
          <span className={`text-sm font-bold ${returnRate >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
            {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Created date */}
      <div className="mt-2 text-[10px] text-gray-400">
        创建于 {new Date(agent.created_at).toLocaleDateString('zh-CN')}
      </div>
    </div>
  );
};

export default AgentCard;
