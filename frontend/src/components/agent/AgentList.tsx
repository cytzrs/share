import React from 'react';
import { GlassCard, Label } from '../ui';
import { AgentCard } from './AgentCard';
import type { ModelAgent, LLMProvider } from '../../types';

interface AgentListProps {
  agents: ModelAgent[];
  selectedAgentId?: string;
  onAgentSelect?: (agent: ModelAgent) => void;
  onCreateClick?: () => void;
  loading?: boolean;
  providers?: LLMProvider[];
}

/**
 * Agent列表组件
 * 以卡片式布局展示所有Agent，支持选择和创建操作
 */
export const AgentList: React.FC<AgentListProps> = ({
  agents,
  selectedAgentId,
  onAgentSelect,
  onCreateClick,
  loading = false,
  providers = [],
}) => {
  // Filter options for status
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'paused'>('all');

  const filteredAgents = React.useMemo(() => {
    if (statusFilter === 'all') return agents;
    return agents.filter(agent => agent.status === statusFilter);
  }, [agents, statusFilter]);

  const statusCounts = React.useMemo(() => ({
    all: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    paused: agents.filter(a => a.status === 'paused').length,
  }), [agents]);

  return (
    <GlassCard className="p-6 rounded-[7px] h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Label>Agent列表</Label>
          <p className="text-xs text-gray-400 mt-1">{agents.length} 个Agent</p>
        </div>
        {onCreateClick && (
          <button 
            onClick={onCreateClick} 
            className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors"
          >
            新建
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100/60">
        <FilterTab 
          label="全部" 
          count={statusCounts.all}
          active={statusFilter === 'all'} 
          onClick={() => setStatusFilter('all')} 
        />
        <FilterTab 
          label="运行中" 
          count={statusCounts.active}
          active={statusFilter === 'active'} 
          onClick={() => setStatusFilter('active')} 
        />
        <FilterTab 
          label="已暂停" 
          count={statusCounts.paused}
          active={statusFilter === 'paused'} 
          onClick={() => setStatusFilter('paused')} 
        />
      </div>

      {/* Agent Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">加载中...</div>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">暂无Agent</p>
          <p className="text-xs text-gray-400">点击上方按钮创建第一个Agent</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              isSelected={selectedAgentId === agent.agent_id}
              onClick={onAgentSelect ? () => onAgentSelect(agent) : undefined}
              providers={providers}
              compact
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
};

// Filter Tab Component
interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const FilterTab: React.FC<FilterTabProps> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150
      ${active 
        ? 'bg-space-black text-white' 
        : 'bg-gray-100/60 text-gray-600 hover:bg-gray-200/60'
      }
    `}
  >
    {label} ({count})
  </button>
);

export default AgentList;
