import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { FinancialMetrics } from '../../../services/api';

/**
 * 财务趋势图组件属性
 */
export interface FinanceTrendChartProps {
  data: FinancialMetrics[];
  height?: number;
}

// 配色方案
const COLORS = {
  revenue: '#6366F1',     // Indigo - 营收
  netProfit: '#10B981',   // Emerald - 净利润
  grossMargin: '#F59E0B', // Amber - 毛利率
  netMargin: '#EC4899',   // Pink - 净利率
};

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
 * 财务趋势图组件
 * 显示营收趋势和利润趋势
 * 需求: 7.2
 */
export const FinanceTrendChart: React.FC<FinanceTrendChartProps> = ({
  data,
  height = 240,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    // 按报告期排序（从旧到新）
    const sortedData = [...data].sort((a, b) => 
      a.report_date.localeCompare(b.report_date)
    );

    const reportDates = sortedData.map(d => d.report_date);
    const revenueData = sortedData.map(d => d.revenue);
    const netProfitData = sortedData.map(d => d.net_profit);
    const grossMarginData = sortedData.map(d => d.gross_margin);
    const netMarginData = sortedData.map(d => d.net_margin);

    // 计算Y轴范围（金额）
    const allAmounts = [...revenueData, ...netProfitData];
    const minAmount = Math.min(...allAmounts);
    const maxAmount = Math.max(...allAmounts);
    const amountRange = maxAmount - minAmount;
    const amountPadding = amountRange * 0.1 || 10000;

    // 计算Y轴范围（百分比）
    const allRatios = [...grossMarginData, ...netMarginData].filter(v => v !== null && v !== undefined);
    const minRatio = allRatios.length > 0 ? Math.min(...allRatios) : 0;
    const maxRatio = allRatios.length > 0 ? Math.max(...allRatios) : 100;
    const ratioPadding = (maxRatio - minRatio) * 0.1 || 5;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 16],
        textStyle: { color: '#1C1C1E', fontSize: 12 },
        extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.12);',
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; color: string; axisValue: string }>;
          if (!items || items.length === 0) return '';
          let html = `<div style="font-size: 11px; color: #8E8E93; margin-bottom: 8px;">${items[0].axisValue}</div>`;
          items.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              const isRatio = item.seriesName.includes('率');
              const formattedValue = isRatio 
                ? `${item.value.toFixed(2)}%` 
                : formatAmount(item.value);
              html += `<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
                <span style="flex: 1; color: #3C3C43;">${item.seriesName}</span>
                <span style="font-weight: 600; color: #1C1C1E; font-variant-numeric: tabular-nums;">${formattedValue}</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        data: ['营业收入', '净利润', '毛利率', '净利率'],
        bottom: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          color: '#3C3C43',
          fontSize: 11,
        },
      },
      grid: {
        left: 60,
        right: 60,
        bottom: 40,
        top: 20,
      },
      xAxis: {
        type: 'category',
        data: reportDates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
          formatter: (value: string) => {
            // 格式化报告期显示，如 "2024-06-30" -> "24Q2"
            const parts = value.split('-');
            if (parts.length >= 2) {
              const year = parts[0].slice(2);
              const month = parseInt(parts[1], 10);
              let quarter = 'Q1';
              if (month >= 10) quarter = 'Q4';
              else if (month >= 7) quarter = 'Q3';
              else if (month >= 4) quarter = 'Q2';
              return `${year}${quarter}`;
            }
            return value;
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '金额',
          min: minAmount - amountPadding,
          max: maxAmount + amountPadding,
          position: 'left',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8E8E93',
            fontSize: 11,
            formatter: (value: number) => formatAmount(value),
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(0, 0, 0, 0.04)',
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: '比率',
          min: Math.max(0, minRatio - ratioPadding),
          max: Math.min(100, maxRatio + ratioPadding),
          position: 'right',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8E8E93',
            fontSize: 11,
            formatter: (value: number) => `${value.toFixed(0)}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '营业收入',
          type: 'bar',
          yAxisIndex: 0,
          data: revenueData,
          barWidth: '25%',
          itemStyle: {
            color: COLORS.revenue,
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '净利润',
          type: 'bar',
          yAxisIndex: 0,
          data: netProfitData.map(value => ({
            value,
            itemStyle: {
              color: value >= 0 ? COLORS.netProfit : '#EF4444',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '25%',
        },
        {
          name: '毛利率',
          type: 'line',
          yAxisIndex: 1,
          data: grossMarginData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: COLORS.grossMargin,
            width: 2,
          },
          itemStyle: {
            color: COLORS.grossMargin,
            borderWidth: 2,
            borderColor: '#fff',
          },
        },
        {
          name: '净利率',
          type: 'line',
          yAxisIndex: 1,
          data: netMarginData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: COLORS.netMargin,
            width: 2,
          },
          itemStyle: {
            color: COLORS.netMargin,
            borderWidth: 2,
            borderColor: '#fff',
          },
        },
      ],
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
        data-testid="finance-trend-chart-empty"
      >
        暂无财务趋势数据
      </div>
    );
  }

  return (
    <div data-testid="finance-trend-chart">
      <ReactECharts
        option={chartOption}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
};

export default FinanceTrendChart;
