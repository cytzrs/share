import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type CapitalFlowData, type CapitalDistribution } from '../../../services/api';
import { CapitalDistributionChart, CapitalFlowTrendChart } from '../charts/CapitalFlowChart';
import { GlassCard } from '../../ui';

export interface CapitalTabProps {
  stockCode: string;
}

/**
 * 格式化金额（亿/万）
 */
function formatAmount(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿';
  }
  if (absValue >= 10000) {
    return (value / 10000).toFixed(2) + '万';
  }
  return value.toFixed(2);
}

/**
 * 资金标签页组件
 * 显示资金流入流出汇总、资金分布饼图、历史资金流向趋势图
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const CapitalTab: React.FC<CapitalTabProps> = ({ stockCode }) => {
  const [capitalFlow, setCapitalFlow] = useState<CapitalFlowData[]>([]);
  const [capitalDistribution, setCapitalDistribution] = useState<CapitalDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载资金流向数据
  const loadCapitalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flowResponse, distributionResponse] = await Promise.all([
        stockApi.getCapitalFlow(stockCode, 10),
        stockApi.getCapitalDistribution(stockCode),
      ]);
      
      setCapitalFlow(flowResponse.data || []);
      setCapitalDistribution(distributionResponse);
    } catch (err) {
      console.error('加载资金数据失败:', err);
      setError('加载资金数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  useEffect(() => {
    loadCapitalData();
  }, [loadCapitalData]);

  // 计算今日资金汇总
  const todaySummary = capitalFlow.length > 0 ? capitalFlow[capitalFlow.length - 1] : null;

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4" data-testid="capital-tab-loading">
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-[280px] bg-gray-200 rounded"></div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-4" data-testid="capital-tab-error">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadCapitalData}
              className="px-4 py-2 bg-space-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 空数据状态
  if (!todaySummary && !capitalDistribution) {
    return (
      <div className="space-y-4" data-testid="capital-tab-empty">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-400">暂无资金流向数据</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="capital-tab">
      {/* 资金流入流出汇总 */}
      {todaySummary && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-4">今日资金流向</h3>
          <CapitalFlowSummary data={todaySummary} />
        </GlassCard>
      )}

      {/* 资金分布饼图 */}
      {capitalDistribution && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-2">资金分布</h3>
          <CapitalDistributionChart data={capitalDistribution} height={280} />
        </GlassCard>
      )}

      {/* 历史资金流向趋势图 */}
      {capitalFlow.length > 0 && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-2">资金流向趋势</h3>
          <CapitalFlowTrendChart data={capitalFlow} height={280} />
        </GlassCard>
      )}
    </div>
  );
};

/**
 * 资金流入流出汇总组件
 */
interface CapitalFlowSummaryProps {
  data: CapitalFlowData;
}

export const CapitalFlowSummary: React.FC<CapitalFlowSummaryProps> = ({ data }) => {
  const summaryItems = [
    {
      label: '总流入',
      value: data.total_inflow,
      color: 'text-profit-green',
      bgColor: 'bg-green-50',
    },
    {
      label: '总流出',
      value: data.total_outflow,
      color: 'text-loss-red',
      bgColor: 'bg-red-50',
    },
    {
      label: '净流入',
      value: data.total_net,
      color: data.total_net >= 0 ? 'text-profit-green' : 'text-loss-red',
      bgColor: data.total_net >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  const detailItems = [
    {
      label: '主力流入',
      value: data.main_inflow,
      color: 'text-profit-green',
    },
    {
      label: '主力流出',
      value: data.main_outflow,
      color: 'text-loss-red',
    },
    {
      label: '主力净流入',
      value: data.main_net,
      color: data.main_net >= 0 ? 'text-profit-green' : 'text-loss-red',
    },
    {
      label: '散户流入',
      value: data.retail_inflow,
      color: 'text-profit-green',
    },
    {
      label: '散户流出',
      value: data.retail_outflow,
      color: 'text-loss-red',
    },
    {
      label: '散户净流入',
      value: data.retail_net,
      color: data.retail_net >= 0 ? 'text-profit-green' : 'text-loss-red',
    },
  ];

  return (
    <div data-testid="capital-flow-summary">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-4" data-testid="capital-summary-cards">
        {summaryItems.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${item.bgColor}`}
            data-testid={`summary-${item.label}`}
          >
            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
            <div className={`text-lg font-semibold ${item.color}`}>
              {item.value >= 0 && item.label === '净流入' ? '+' : ''}
              {formatAmount(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* 详细数据 */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm" data-testid="capital-detail-grid">
        {detailItems.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-1" data-testid={`detail-${item.label}`}>
            <span className="text-gray-500">{item.label}</span>
            <span className={`font-medium ${item.color}`}>
              {(item.label.includes('净') && item.value >= 0) ? '+' : ''}
              {formatAmount(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CapitalTab;
