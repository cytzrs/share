import React, { useState, useEffect } from 'react';
import { GlassCard, Label, StatusLabel, ModelIcon } from '../ui';
import { agentApi } from '../../services/api';
import type { ModelAgent, PortfolioMetrics, AgentStatus, LLMProvider, Position } from '../../types';

interface AgentDetailPanelProps {
  agent: ModelAgent;
  metrics?: PortfolioMetrics | null;
  onEdit?: () => void;
  onPause?: () => Promise<void>;
  onResume?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onTrigger?: () => Promise<void>;
  loading?: boolean;
  providers?: LLMProvider[];
}

/**
 * Agent详情面板组件
 * 展示Agent配置和状态，提供操作按钮（暂停/恢复/删除）
 */
export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agent,
  metrics,
  onEdit,
  onPause,
  onResume,
  onDelete,
  onTrigger,
  loading = false,
  providers = [],
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showDeleteConfirm]);

  // Find provider name
  const provider = providers.find(p => p.provider_id === agent.provider_id);
  const providerName = provider?.name || '未设置';

  // Load positions when agent changes
  useEffect(() => {
    const loadPositions = async () => {
      setPositionsLoading(true);
      try {
        const portfolio = await agentApi.getPortfolio(agent.agent_id);
        setPositions(portfolio.positions || []);
      } catch {
        setPositions([]);
      } finally {
        setPositionsLoading(false);
      }
    };
    loadPositions();
  }, [agent.agent_id]);

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
  
  // Calculate real-time metrics based on positions
  const calculatedMetrics = React.useMemo(() => {
    const totalMarketValue = positions.reduce((sum, pos) => {
      const currentPrice = Number(pos.current_price) || Number(pos.avg_cost);
      return sum + currentPrice * pos.shares;
    }, 0);
    
    const totalAssets = agent.current_cash + totalMarketValue;
    const totalProfit = totalAssets - agent.initial_cash;
    const returnRate = agent.initial_cash > 0 ? (totalProfit / agent.initial_cash) * 100 : 0;
    
    return {
      totalMarketValue,
      totalAssets,
      totalProfit,
      returnRate,
    };
  }, [agent.current_cash, agent.initial_cash, positions]);

  // Use calculated metrics (always prefer calculated when positions are loaded)
  const displayMetrics = {
    totalAssets: positions.length > 0 ? calculatedMetrics.totalAssets : (agent.total_assets ?? metrics?.total_assets ?? agent.current_cash),
    totalMarketValue: positions.length > 0 ? calculatedMetrics.totalMarketValue : (agent.total_market_value ?? metrics?.total_market_value ?? 0),
    returnRate: positions.length > 0 ? calculatedMetrics.returnRate : (agent.return_rate ?? metrics?.return_rate ?? 0),
    annualReturnRate: metrics?.annual_return_rate ?? 0,
    maxDrawdown: metrics?.max_drawdown ?? 0,
    sharpeRatio: metrics?.sharpe_ratio ?? 0,
  };

  const handleAction = async (action: string, handler?: () => Promise<void>) => {
    if (!handler || actionLoading) return;
    setActionLoading(action);
    try {
      await handler();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (onDelete) {
      await handleAction('delete', onDelete);
    }
    setShowDeleteConfirm(false);
  };

  const formatCurrency = (value: number | string | undefined | null): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (value: number | string | undefined | null): string => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  return (
    <GlassCard className="p-4 rounded-[7px] h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex-shrink-0"><ModelIcon modelName={agent.llm_model} size={24} /></span>
            <h2 className="text-lg font-bold text-space-black truncate">{agent.name}</h2>
            <StatusLabel status={statusConfig.statusType} className="text-[10px] px-1.5 py-0.5">
              {statusConfig.label}
            </StatusLabel>
          </div>
          <p className="text-[10px] text-gray-400 font-mono">{agent.agent_id}</p>
        </div>
        {onEdit && agent.status !== 'deleted' && (
          <button onClick={onEdit} disabled={loading} className="p-1.5 rounded-lg hover:bg-gray-100/60 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      {/* Configuration & Stats in compact grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniStat label="渠道" value={providerName} />
        <MiniStat label="模型" value={agent.llm_model} />
        <MiniStat label="周期" value={agent.schedule_type === 'daily' ? '每日' : '每小时'} />
        <MiniStat label="状态" value={statusConfig.label} />
      </div>

      {/* Financial Stats - Compact */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniStat label="初始资金" value={`¥${formatCurrency(agent.initial_cash)}`} />
        <MiniStat label="当前现金" value={`¥${formatCurrency(agent.current_cash)}`} />
        <MiniStat label="总资产" value={`¥${formatCurrency(displayMetrics.totalAssets)}`} />
        <MiniStat label="持仓市值" value={`¥${formatCurrency(displayMetrics.totalMarketValue)}`} />
      </div>

      {/* Performance - Compact */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniStat 
          label="收益率" 
          value={formatPercent(displayMetrics.returnRate)}
          valueColor={displayMetrics.returnRate >= 0 ? 'text-profit-green' : 'text-loss-red'}
        />
        <MiniStat 
          label="年化收益" 
          value={formatPercent(displayMetrics.annualReturnRate)}
          valueColor={displayMetrics.annualReturnRate >= 0 ? 'text-profit-green' : 'text-loss-red'}
        />
        <MiniStat 
          label="最大回撤" 
          value={formatPercent(-Math.abs(displayMetrics.maxDrawdown))}
          valueColor="text-loss-red"
        />
        <MiniStat 
          label="夏普比率" 
          value={displayMetrics.sharpeRatio.toFixed(2)}
        />
      </div>

      {/* Positions Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">当前持仓</Label>
          <span className="text-[10px] text-gray-400">{positions.length} 只股票</span>
        </div>
        {positionsLoading ? (
          <div className="text-center text-gray-400 text-xs py-4">加载中...</div>
        ) : positions.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-4 bg-gray-50/50 rounded-lg">暂无持仓</div>
        ) : (
          <div className="bg-gray-50/50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase">
                  <th className="text-left py-1.5 px-2">股票</th>
                  <th className="text-right py-1.5 px-2">数量</th>
                  <th className="text-right py-1.5 px-2">成本</th>
                  <th className="text-right py-1.5 px-2">市值</th>
                  <th className="text-right py-1.5 px-2">盈亏</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((pos) => {
                  const currentPrice = Number(pos.current_price) || Number(pos.avg_cost);
                  const marketValue = currentPrice * pos.shares;
                  const cost = Number(pos.avg_cost) * pos.shares;
                  const profit = marketValue - cost;
                  const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
                  return (
                    <tr key={pos.stock_code} className="hover:bg-white/50">
                      <td className="py-1.5 px-2 font-medium text-space-black">{pos.stock_code}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{pos.shares}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">¥{Number(pos.avg_cost).toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">¥{formatCurrency(marketValue)}</td>
                      <td className={`py-1.5 px-2 text-right font-medium ${profitRate >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                        {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Buttons - Compact */}
      {agent.status !== 'deleted' && (
        <div className="pt-3 border-t border-gray-100/60">
          <div className="flex flex-wrap gap-2">
            {onTrigger && agent.status === 'active' && (
              <button
                onClick={() => handleAction('trigger', onTrigger)}
                disabled={loading || actionLoading !== null}
                className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'trigger' ? '触发中...' : '触发决策'}
              </button>
            )}
            {agent.status === 'active' && onPause && (
              <button
                onClick={() => handleAction('pause', onPause)}
                disabled={loading || actionLoading !== null}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'pause' ? '...' : '暂停'}
              </button>
            )}
            {agent.status === 'paused' && onResume && (
              <button
                onClick={() => handleAction('resume', onResume)}
                disabled={loading || actionLoading !== null}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'resume' ? '...' : '恢复'}
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || actionLoading !== null}
                className="px-4 py-1.5 text-sm font-medium text-loss-red bg-loss-red/10 hover:bg-loss-red/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                删除
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-2xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">确定要删除Agent "{agent.name}" 吗？</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading === 'delete'}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={actionLoading === 'delete'}
                className="px-3 py-1.5 text-xs rounded-lg font-bold text-white bg-loss-red hover:bg-loss-red/90"
              >
                {actionLoading === 'delete' ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

// Mini Stat Component - More compact
interface MiniStatProps {
  label: string;
  value: string;
  valueColor?: string;
}

const MiniStat: React.FC<MiniStatProps> = ({ label, value, valueColor = 'text-space-black' }) => (
  <div className="bg-gray-50/50 rounded-lg p-2">
    <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 truncate">{label}</div>
    <div className={`text-xs font-semibold ${valueColor} truncate`}>{value}</div>
  </div>
);

export default AgentDetailPanel;
