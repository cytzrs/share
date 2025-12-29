import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/ui';
import { ActiveAgentsList } from '../components/dashboard';
import { AssetCurveChart, PositionBarChart, type AssetDataPoint, type AgentAssetData, type StockPositionSummary, type AgentInfo } from '../components/charts';
import { agentApi, marketApi, llmProviderApi } from '../services/api';
import { DashboardSkeleton } from '../components/common';
import type { ModelAgent } from '../types';

// 市场概览数据类型
interface MarketOverview {
  market_sentiment: {
    fear_greed_index: number;
    market_mood: string;
    trading_activity: string;
    up_count: number;
    down_count: number;
    flat_count: number;
    total_count: number;
    limit_up_count: number;
    limit_down_count: number;
    updated_at: string | null;
  };
  indices: Array<{
    name: string;
    code: string;
    current: number;
    change: number;
    change_pct: number;
  }>;
}

// 接口统计数据类型
interface ApiStats {
  latency_ranking: Array<{
    provider_name: string;
    model_name: string;
    avg_duration_ms: number;
    call_count: number;
  }>;
  call_ranking: Array<{
    provider_name: string;
    call_count: number;
    success_count: number;
    success_rate: number;
  }>;
}

/**
 * Dashboard页面 - 仪表盘首页
 */
const Dashboard: React.FC = () => {
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  const [agentsAssetData, setAgentsAssetData] = useState<AgentAssetData[]>([]);
  const [positionStocks, setPositionStocks] = useState<StockPositionSummary[]>([]);
  const [positionAgents, setPositionAgents] = useState<AgentInfo[]>([]);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [apiStats, setApiStats] = useState<ApiStats | null>(null);
  const [statsTab, setStatsTab] = useState<'latency' | 'calls'>('latency');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行加载所有数据
      const [agentsResponse, marketResponse, statsResponse, positionsSummary] = await Promise.all([
        agentApi.list({ page: 1, page_size: 100 }),
        marketApi.getOverview(),
        llmProviderApi.getStatsOverview(),
        agentApi.getPositionsSummary(),
      ]);

      setAgents(agentsResponse.items);
      setMarketOverview(marketResponse);
      setApiStats(statsResponse);
      setPositionStocks(positionsSummary.stocks);
      setPositionAgents(positionsSummary.agents);

      await generateAgentsAssetCurve(agentsResponse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };


  const generateAgentsAssetCurve = async (agentsList: ModelAgent[]) => {
    try {
      // 批量获取所有 Agent 资产历史
      const allHistories = await agentApi.getAllAssetHistories();
      
      const agentsData = agentsList.map((agent) => {
        const historyData = allHistories[agent.agent_id];
        const currentValue = agent.total_assets ?? agent.current_cash;
        
        let data: AssetDataPoint[];
        if (historyData && historyData.history && historyData.history.length > 0) {
          data = historyData.history.map(item => ({
            date: item.date,
            value: item.value,
            returnRate: agent.initial_cash > 0 ? ((item.value - agent.initial_cash) / agent.initial_cash) * 100 : 0,
          }));
        } else {
          const today = new Date().toISOString().split('T')[0];
          const createdDate = new Date(agent.created_at).toISOString().split('T')[0];
          data = [
            { date: createdDate, value: agent.initial_cash, returnRate: 0 },
            { date: today, value: currentValue, returnRate: agent.initial_cash > 0 ? ((currentValue - agent.initial_cash) / agent.initial_cash) * 100 : 0 },
          ];
        }
        
        return {
          agentId: agent.agent_id,
          agentName: agent.name,
          llmModel: agent.llm_model,
          initialCash: agent.initial_cash,
          data,
        };
      });
      
      setAgentsAssetData(agentsData);
    } catch {
      // 降级：逐个获取
      const agentsData = agentsList.map((agent) => {
        const currentValue = agent.total_assets ?? agent.current_cash;
        const today = new Date().toISOString().split('T')[0];
        return {
          agentId: agent.agent_id,
          agentName: agent.name,
          llmModel: agent.llm_model,
          initialCash: agent.initial_cash,
          data: [{ date: today, value: currentValue, returnRate: agent.initial_cash > 0 ? ((currentValue - agent.initial_cash) / agent.initial_cash) * 100 : 0 }],
        };
      });
      setAgentsAssetData(agentsData);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center">
        <GlassCard className="max-w-md">
          <div className="text-center">
            <div className="text-loss-red mb-4">加载失败</div>
            <p className="text-gray-500 mb-4">{error}</p>
            <button onClick={loadDashboardData} className="text-info-blue hover:underline">重试</button>
          </div>
        </GlassCard>
      </div>
    );
  }

  const sentiment = marketOverview?.market_sentiment;
  const upCount = sentiment?.up_count || 0;
  const downCount = sentiment?.down_count || 0;
  const totalUpDown = upCount + downCount;

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-6">
        {/* 第一行：资产曲线 + 活跃Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AssetCurveChart agentsData={agentsAssetData} title="Agent资产曲线" height={320} />
          </div>
          <div className="lg:col-span-1">
            <ActiveAgentsList agents={agents.filter(a => a.status === 'active')} />
          </div>
        </div>

        {/* 第二行：股市概览 + 接口统计 + 预留区域（三等分） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 股市概览 */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4">股市概览</h3>
            {marketOverview ? (
              <div className="space-y-4">
                {/* 大盘指数 */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">大盘指数</div>
                  <div className="grid grid-cols-2 gap-2">
                    {marketOverview.indices.slice(0, 4).map(idx => (
                      <div key={idx.code} className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">{idx.name}</div>
                        <div className="font-semibold text-sm">{idx.current.toFixed(2)}</div>
                        <div className={`text-xs ${idx.change_pct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 恐惧贪婪指数 */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">恐惧贪婪指数</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          (sentiment?.fear_greed_index || 50) >= 50 ? 'bg-red-400' : 'bg-green-400'
                        }`}
                        style={{ width: `${sentiment?.fear_greed_index || 50}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold">{sentiment?.fear_greed_index || 50}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-center">{sentiment?.market_mood || '中性'}</div>
                </div>

                {/* 涨跌家数饼图 */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">涨跌分布</div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg viewBox="0 0 36 36" className="w-full h-full">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle 
                          cx="18" cy="18" r="15.9" fill="none" 
                          stroke="#ef4444" strokeWidth="3"
                          strokeDasharray={`${totalUpDown > 0 ? (upCount / totalUpDown) * 100 : 50} 100`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-red-500">↑ 上涨</span>
                        <span className="font-medium">{upCount} 家</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-500">↓ 下跌</span>
                        <span className="font-medium">{downCount} 家</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">— 平盘</span>
                        <span className="font-medium">{sentiment?.flat_count || 0} 家</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">暂无数据</div>
            )}
          </GlassCard>

          {/* 接口统计 */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700">接口统计</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatsTab('latency')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    statsTab === 'latency'
                      ? 'bg-space-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  耗时
                </button>
                <button
                  onClick={() => setStatsTab('calls')}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    statsTab === 'calls'
                      ? 'bg-space-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  调用
                </button>
              </div>
            </div>

            {apiStats ? (
              <div className="overflow-y-auto max-h-80">
                {statsTab === 'latency' ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">渠道</th>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">模型</th>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...apiStats.latency_ranking].sort((a, b) => b.avg_duration_ms - a.avg_duration_ms).slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                          <td className="py-3 px-3 text-gray-700 text-left">{item.provider_name}</td>
                          <td className="py-3 px-3 text-gray-600 text-left truncate text-sm">{item.model_name}</td>
                          <td className="py-3 px-3 text-gray-700 text-left font-medium">{item.avg_duration_ms.toFixed(0)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">渠道</th>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">调用</th>
                        <th className="text-left py-3 px-3 text-gray-600 font-semibold">成功率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiStats.call_ranking.slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                          <td className="py-3 px-3 text-gray-700 text-left">{item.provider_name}</td>
                          <td className="py-3 px-3 text-gray-700 text-left font-medium">{item.call_count}</td>
                          <td className="py-3 px-3 text-left">
                            <span className={`font-medium ${item.success_rate >= 95 ? 'text-green-600' : item.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {item.success_rate.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">暂无数据</div>
            )}
          </GlassCard>

          {/* 预留区域 */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4">平台公告</h3>
            <div className="h-full flex items-center justify-center text-gray-400 min-h-64">
              敬请期待
            </div>
          </GlassCard>
        </div>

        {/* 第三行：Agent持仓分布柱状图 */}
        <div className="grid grid-cols-1 gap-6">
          <PositionBarChart
            stocks={positionStocks}
            agents={positionAgents}
            title="Agent持仓分布"
            height={320}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
