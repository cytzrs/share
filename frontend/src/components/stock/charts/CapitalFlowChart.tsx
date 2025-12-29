import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { CapitalFlowData, CapitalDistribution } from '../../../services/api';

/**
 * 资金流向饼图组件属性
 */
export interface CapitalDistributionChartProps {
  data: CapitalDistribution;
  height?: number;
}

/**
 * 资金流向趋势图组件属性
 */
export interface CapitalFlowTrendChartProps {
  data: CapitalFlowData[];
  height?: number;
}

// 配色方案
const COLORS = {
  superLarge: '#6366F1', // Indigo - 超大单
  large: '#10B981',      // Emerald - 大单
  medium: '#F59E0B',     // Amber - 中单
  small: '#EC4899',      // Pink - 小单
  inflow: '#10B981',     // Green - 流入
  outflow: '#EF4444',    // Red - 流出
  mainNet: '#6366F1',    // Indigo - 主力净流入
  retailNet: '#F59E0B',  // Amber - 散户净流入
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
 * 资金分布饼图组件
 * 显示超大单、大单、中单、小单的资金分布
 * 需求: 4.3
 */
export const CapitalDistributionChart: React.FC<CapitalDistributionChartProps> = ({
  data,
  height = 280,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    // 计算各类型净流入
    const pieData = [
      { name: '超大单', value: Math.abs(data.super_large.net), net: data.super_large.net },
      { name: '大单', value: Math.abs(data.large.net), net: data.large.net },
      { name: '中单', value: Math.abs(data.medium.net), net: data.medium.net },
      { name: '小单', value: Math.abs(data.small.net), net: data.small.net },
    ];

    const colors = [COLORS.superLarge, COLORS.large, COLORS.medium, COLORS.small];

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 16],
        textStyle: { color: '#1C1C1E', fontSize: 12 },
        extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.12);',
        formatter: (params: unknown) => {
          const p = params as { name: string; data: { net: number }; percent: number };
          const netValue = p.data.net;
          const sign = netValue >= 0 ? '+' : '';
          const color = netValue >= 0 ? '#10B981' : '#EF4444';
          return `<div>
            <div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
            <div style="color: ${color}; font-weight: 500;">${sign}${formatAmount(netValue)}</div>
            <div style="color: #8E8E93; font-size: 11px; margin-top: 2px;">占比: ${p.percent.toFixed(1)}%</div>
          </div>`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        textStyle: {
          color: '#3C3C43',
          fontSize: 12,
        },
        formatter: (name: string) => {
          const item = pieData.find(d => d.name === name);
          if (item) {
            const sign = item.net >= 0 ? '+' : '';
            return `${name}  ${sign}${formatAmount(item.net)}`;
          }
          return name;
        },
      },
      series: [
        {
          name: '资金分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          labelLine: {
            show: false,
          },
          data: pieData.map((item, index) => ({
            ...item,
            itemStyle: { color: colors[index] },
          })),
        },
      ],
    };
  }, [data]);

  return (
    <div data-testid="capital-distribution-chart">
      <ReactECharts
        option={chartOption}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
};

/**
 * 资金流向趋势图组件
 * 显示历史资金流向趋势（主力净流入、散户净流入）
 * 需求: 4.4
 */
export const CapitalFlowTrendChart: React.FC<CapitalFlowTrendChartProps> = ({
  data,
  height = 280,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    const dates = data.map(d => d.date);
    const mainNetData = data.map(d => d.main_net);
    const retailNetData = data.map(d => d.retail_net);

    // 计算Y轴范围
    const allValues = [...mainNetData, ...retailNetData];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    const padding = range * 0.2 || 10000;

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
              const sign = item.value >= 0 ? '+' : '';
              const color = item.value >= 0 ? '#10B981' : '#EF4444';
              html += `<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
                <span style="flex: 1; color: #3C3C43;">${item.seriesName}</span>
                <span style="font-weight: 600; color: ${color}; font-variant-numeric: tabular-nums;">${sign}${formatAmount(item.value)}</span>
              </div>`;
            }
          });
          return html;
        },
      },
      legend: {
        data: ['主力净流入', '散户净流入'],
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
        right: 20,
        bottom: 40,
        top: 20,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
          formatter: (value: string) => {
            const parts = value.split('-');
            return `${parts[1]}/${parts[2]}`;
          },
        },
      },
      yAxis: {
        type: 'value',
        min: minValue - padding,
        max: maxValue + padding,
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
      series: [
        {
          name: '主力净流入',
          type: 'bar',
          data: mainNetData.map(value => ({
            value,
            itemStyle: {
              color: value >= 0 ? COLORS.inflow : COLORS.outflow,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '35%',
        },
        {
          name: '散户净流入',
          type: 'line',
          data: retailNetData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: COLORS.retailNet,
            width: 2,
          },
          itemStyle: {
            color: COLORS.retailNet,
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
        data-testid="capital-flow-trend-chart-empty"
      >
        暂无资金流向数据
      </div>
    );
  }

  return (
    <div data-testid="capital-flow-trend-chart">
      <ReactECharts
        option={chartOption}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
};

export default { CapitalDistributionChart, CapitalFlowTrendChart };
