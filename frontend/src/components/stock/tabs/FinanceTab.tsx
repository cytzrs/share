import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type FinancialMetrics, type BalanceSheet, type CashFlow } from '../../../services/api';
import { GlassCard } from '../../ui';
import { FinanceTrendChart } from '../charts/FinanceTrendChart';

export interface FinanceTabProps {
  stockCode: string;
}

/**
 * 格式化金额（亿/万）
 */
export function formatAmount(value: number): string {
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
 * 格式化百分比
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return value.toFixed(2) + '%';
}

/**
 * 财务标签页组件
 * 显示关键财务指标、资产负债表摘要、现金流量表摘要、财务比率对比
 * 需求: 7.1, 7.3, 7.4, 7.5, 7.6
 */
export const FinanceTab: React.FC<FinanceTabProps> = ({ stockCode }) => {
  const [financials, setFinancials] = useState<FinancialMetrics[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载财务数据
  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [financialsResponse, balanceSheetResponse, cashFlowResponse] = await Promise.all([
        stockApi.getFinancials(stockCode, { periods: 4 }),
        stockApi.getBalanceSheet(stockCode, 4),
        stockApi.getCashFlow(stockCode, 4),
      ]);
      
      setFinancials(financialsResponse.data || []);
      setBalanceSheet(balanceSheetResponse.data || []);
      setCashFlow(cashFlowResponse.data || []);
    } catch (err) {
      console.error('加载财务数据失败:', err);
      setError('加载财务数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4" data-testid="finance-tab-loading">
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-[200px] bg-gray-200 rounded"></div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-4" data-testid="finance-tab-error">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadFinanceData}
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
  if (financials.length === 0 && balanceSheet.length === 0 && cashFlow.length === 0) {
    return (
      <div className="space-y-4" data-testid="finance-tab-empty">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400">暂无财务数据</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 获取最新一期财务数据
  const latestFinancials = financials.length > 0 ? financials[0] : null;
  const latestBalanceSheet = balanceSheet.length > 0 ? balanceSheet[0] : null;
  const latestCashFlow = cashFlow.length > 0 ? cashFlow[0] : null;

  return (
    <div className="space-y-4" data-testid="finance-tab">
      {/* 关键财务指标 */}
      {latestFinancials && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-4">关键财务指标</h3>
          <FinancialMetricsDisplay data={latestFinancials} />
        </GlassCard>
      )}

      {/* 财务趋势图 */}
      {financials.length > 1 && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-2">财务趋势</h3>
          <FinanceTrendChart data={financials} height={240} />
        </GlassCard>
      )}

      {/* 资产负债表摘要 */}
      {latestBalanceSheet && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-4">资产负债表摘要</h3>
          <BalanceSheetSummary data={latestBalanceSheet} />
        </GlassCard>
      )}

      {/* 现金流量表摘要 */}
      {latestCashFlow && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-4">现金流量表摘要</h3>
          <CashFlowSummary data={latestCashFlow} />
        </GlassCard>
      )}

      {/* 财务比率对比 */}
      {latestFinancials && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-4">财务比率</h3>
          <FinancialRatios data={latestFinancials} />
        </GlassCard>
      )}
    </div>
  );
};


/**
 * 关键财务指标显示组件
 */
interface FinancialMetricsDisplayProps {
  data: FinancialMetrics;
}

export const FinancialMetricsDisplay: React.FC<FinancialMetricsDisplayProps> = ({ data }) => {
  const metricsItems = [
    {
      label: '营业收入',
      value: formatAmount(data.revenue),
      change: data.revenue_yoy,
      testId: 'metric-revenue',
    },
    {
      label: '净利润',
      value: formatAmount(data.net_profit),
      change: data.net_profit_yoy,
      testId: 'metric-net-profit',
    },
    {
      label: '毛利率',
      value: formatPercentage(data.gross_margin),
      testId: 'metric-gross-margin',
    },
    {
      label: '净利率',
      value: formatPercentage(data.net_margin),
      testId: 'metric-net-margin',
    },
    {
      label: '每股收益',
      value: data.eps?.toFixed(2) || '-',
      testId: 'metric-eps',
    },
    {
      label: '每股净资产',
      value: data.bps?.toFixed(2) || '-',
      testId: 'metric-bps',
    },
    {
      label: '净资产收益率',
      value: formatPercentage(data.roe),
      testId: 'metric-roe',
    },
    {
      label: '报告期',
      value: data.report_date || '-',
      testId: 'metric-report-date',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4" data-testid="financial-metrics-display">
      {metricsItems.map((item, index) => (
        <div
          key={index}
          className="p-3 bg-gray-50 rounded-lg"
          data-testid={item.testId}
        >
          <div className="text-xs text-gray-500 mb-1">{item.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">{item.value}</span>
            {item.change !== undefined && (
              <span
                className={`text-xs ${item.change >= 0 ? 'text-profit-green' : 'text-loss-red'}`}
                data-testid={`${item.testId}-yoy`}
              >
                {item.change >= 0 ? '+' : ''}{formatPercentage(item.change)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 资产负债表摘要组件
 */
interface BalanceSheetSummaryProps {
  data: BalanceSheet;
}

export const BalanceSheetSummary: React.FC<BalanceSheetSummaryProps> = ({ data }) => {
  const items = [
    { label: '总资产', value: formatAmount(data.total_assets), testId: 'bs-total-assets' },
    { label: '总负债', value: formatAmount(data.total_liabilities), testId: 'bs-total-liabilities' },
    { label: '股东权益', value: formatAmount(data.total_equity), testId: 'bs-total-equity' },
    { label: '流动资产', value: formatAmount(data.current_assets), testId: 'bs-current-assets' },
    { label: '流动负债', value: formatAmount(data.current_liabilities), testId: 'bs-current-liabilities' },
    { label: '货币资金', value: formatAmount(data.cash_and_equivalents), testId: 'bs-cash' },
  ];

  // 计算资产负债率
  const debtRatio = data.total_assets > 0 
    ? (data.total_liabilities / data.total_assets * 100) 
    : 0;

  // 计算流动比率
  const currentRatio = data.current_liabilities > 0 
    ? (data.current_assets / data.current_liabilities) 
    : 0;

  return (
    <div data-testid="balance-sheet-summary">
      <div className="text-xs text-gray-500 mb-3">报告期: {data.report_date}</div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {items.map((item, index) => (
          <div key={index} className="flex flex-col" data-testid={item.testId}>
            <span className="text-gray-500 text-xs">{item.label}</span>
            <span className="text-gray-900 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
        <div className="flex flex-col" data-testid="bs-debt-ratio">
          <span className="text-gray-500 text-xs">资产负债率</span>
          <span className="text-gray-900 font-medium">{formatPercentage(debtRatio)}</span>
        </div>
        <div className="flex flex-col" data-testid="bs-current-ratio">
          <span className="text-gray-500 text-xs">流动比率</span>
          <span className="text-gray-900 font-medium">{currentRatio.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 现金流量表摘要组件
 */
interface CashFlowSummaryProps {
  data: CashFlow;
}

export const CashFlowSummary: React.FC<CashFlowSummaryProps> = ({ data }) => {
  const items = [
    {
      label: '经营活动现金流',
      value: data.operating_cash_flow,
      testId: 'cf-operating',
    },
    {
      label: '投资活动现金流',
      value: data.investing_cash_flow,
      testId: 'cf-investing',
    },
    {
      label: '筹资活动现金流',
      value: data.financing_cash_flow,
      testId: 'cf-financing',
    },
    {
      label: '现金净流量',
      value: data.net_cash_flow,
      testId: 'cf-net',
    },
  ];

  return (
    <div data-testid="cash-flow-summary">
      <div className="text-xs text-gray-500 mb-3">报告期: {data.report_date}</div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 rounded-lg"
            data-testid={item.testId}
          >
            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
            <div className={`text-lg font-semibold ${item.value >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
              {item.value >= 0 ? '+' : ''}{formatAmount(item.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 财务比率组件
 */
interface FinancialRatiosProps {
  data: FinancialMetrics;
}

export const FinancialRatios: React.FC<FinancialRatiosProps> = ({ data }) => {
  const ratios = [
    {
      label: '毛利率',
      value: data.gross_margin,
      benchmark: 30, // 行业平均参考值
      testId: 'ratio-gross-margin',
    },
    {
      label: '净利率',
      value: data.net_margin,
      benchmark: 10,
      testId: 'ratio-net-margin',
    },
    {
      label: 'ROE',
      value: data.roe,
      benchmark: 15,
      testId: 'ratio-roe',
    },
  ];

  return (
    <div className="space-y-4" data-testid="financial-ratios">
      {ratios.map((ratio, index) => {
        const value = ratio.value || 0;
        const maxValue = Math.max(value, ratio.benchmark, 50);
        const valueWidth = (value / maxValue) * 100;
        const benchmarkPosition = (ratio.benchmark / maxValue) * 100;
        
        return (
          <div key={index} data-testid={ratio.testId}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">{ratio.label}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatPercentage(value)}
              </span>
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`absolute h-full rounded-full ${value >= ratio.benchmark ? 'bg-profit-green' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(valueWidth, 100)}%` }}
              />
              <div
                className="absolute h-full w-0.5 bg-gray-400"
                style={{ left: `${benchmarkPosition}%` }}
                title={`行业平均: ${ratio.benchmark}%`}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-400">0%</span>
              <span className="text-xs text-gray-400">行业平均: {ratio.benchmark}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FinanceTab;
