import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, Label, StatusLabel, ModelIcon } from '../ui';
import type { ModelAgent } from '../../types';

interface ActiveAgentsListProps {
  agents: ModelAgent[];
  onAgentClick?: (agent: ModelAgent) => void;
}

// 计算Agent收益率的辅助函数
const getAgentReturnRate = (agent: ModelAgent): number => {
  const totalAssets = agent.total_assets ?? agent.current_cash;
  return agent.return_rate ?? (agent.initial_cash > 0 ? ((totalAssets - agent.initial_cash) / agent.initial_cash) * 100 : 0);
};

/**
 * 活跃Agent列表组件
 * 以卡片形式展示活跃的AI交易Agent
 * 固定高度，按收益率降序排序，支持滚动
 */
export const ActiveAgentsList: React.FC<ActiveAgentsListProps> = ({ agents, onAgentClick }) => {
  const navigate = useNavigate();
  
  // 按收益率降序排序
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => getAgentReturnRate(b) - getAgentReturnRate(a));
  }, [agents]);
  
  const handleAgentClick = (agent: ModelAgent) => {
    if (onAgentClick) {
      onAgentClick(agent);
    } else {
      // 默认跳转到 Agent 详情页
      navigate(`/portfolio?agent_id=${agent.agent_id}`);
    }
  };
  
  return (
    <GlassCard className="p-4 rounded-[7px] h-[550px] flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <Label>活跃Agent</Label>
        <span className="text-xs text-gray-400">{agents.length} 个</span>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 gap-2">
          {sortedAgents.length === 0 ? (
            <div className="col-span-2 text-center text-gray-400 py-6">
              暂无活跃Agent
            </div>
          ) : (
            sortedAgents.map((agent) => (
              <AgentCard 
                key={agent.agent_id} 
                agent={agent} 
                onClick={() => handleAgentClick(agent)}
              />
            ))
          )}
        </div>
      </div>
    </GlassCard>
  );
};

// Agent Card Component
interface AgentCardProps {
  agent: ModelAgent;
  onClick?: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const totalAssets = agent.total_assets ?? agent.current_cash;
  const returnRate = agent.return_rate ?? (agent.initial_cash > 0 ? ((totalAssets - agent.initial_cash) / agent.initial_cash) * 100 : 0);
  
  return (
    <div 
      className={`
        bg-white/60 rounded-lg p-3 border border-gray-100/60 
        hover:shadow-sm transition-all duration-200
        ${onClick ? 'cursor-pointer hover:bg-white/80 active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
          <span className="flex-shrink-0"><ModelIcon modelName={agent.llm_model} size={20} /></span>
          <span className="font-semibold text-space-black truncate text-sm">{agent.name}</span>
        </div>
        <StatusLabel status={returnRate >= 0 ? 'profit' : 'loss'} className="text-[10px] px-1.5 py-0.5 flex-shrink-0">
          {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
        </StatusLabel>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400 truncate">{agent.llm_model}</span>
        <span className="text-gray-600 flex-shrink-0">¥{totalAssets.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default ActiveAgentsList;
