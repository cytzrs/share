import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GlassCard, Label } from '../ui';

// Agent持仓数据
export interface AgentPosition {
  agent_id: string;
  agent_name: string;
  shares: number;
  market_value: number;
}

// 股票持仓汇总
export interface StockPositionSummary {
  stock_code: string;
  stock_name: string;
  positions: AgentPosition[];
}

// Agent信息
export interface AgentInfo {
  agent_id: string;
  name: string;
  llm_model: string;
}

interface PositionBarChartProps {
  stocks: StockPositionSummary[];
  agents: AgentInfo[];
  title?: string;
  height?: number;
  showCard?: boolean;
}

// Agent配色
const AGENT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6',
  '#14B8A6', '#F97316', '#06B6D4', '#EF4444', '#84CC16',
];

export const PositionBarChart: React.FC<PositionBarChartProps> = ({
  stocks,
  agents,
  title = 'Agent持仓分布',
  height = 320,
  showCard = true,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    if (!stocks || stocks.length === 0 || !agents || agents.length === 0) {
      return {};
    }

    // X轴：股票名称
    const xAxisData = stocks.map(s => s.stock_name || s.stock_code);

    // 为每个Agent创建一个series
    const series = agents.map((agent, index) => {
      const color = AGENT_COLORS[index % AGENT_COLORS.length];
      const data = stocks.map(stock => {
        const pos = stock.positions.find(p => p.agent_id === agent.agent_id);
        return pos ? pos.market_value : 0;
      });

      return {
        name: agent.name,
        type: 'bar' as const,
        stack: 'total',
        data,
        itemStyle: { color },
        emphasis: { focus: 'series' as const },
        barMaxWidth: 40,
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
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
          let total = 0;
          items.forEach(item => {
            if (item.value > 0) {
              total += item.value;
              const formatted = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(item.value);
              html += `<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
                <span style="flex: 1; color: #3C3C43;">${item.seriesName}</span>
                <span style="font-weight: 600; color: #1C1C1E;">${formatted}</span>
              </div>`;
            }
          });
          if (total > 0) {
            const totalFormatted = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(total);
            html += `<div style="border-top: 1px solid #eee; margin-top: 8px; padding-top: 8px; font-weight: 600;">合计: ${totalFormatted}</div>`;
          }
          return html;
        },
      },
      legend: {
        show: true,
        bottom: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 16,
        textStyle: { fontSize: 11, color: '#666' },
      },
      grid: { left: 50, right: 20, bottom: 50, top: 20 },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
          rotate: stocks.length > 6 ? 30 : 0,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
            return value.toFixed(0);
          },
        },
        splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.04)', type: 'dashed' } },
      },
      series,
    };
  }, [stocks, agents]);

  const hasData = stocks && stocks.length > 0 && agents && agents.length > 0;

  const chartContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm">{title}</Label>
      </div>
      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            暂无持仓数据
          </div>
        ) : (
          <ReactECharts
            option={chartOption}
            style={{ height: height - 40, width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        )}
      </div>
    </div>
  );

  if (showCard) {
    return (
      <GlassCard className="p-5 rounded-xl h-full">
        {chartContent}
      </GlassCard>
    );
  }

  return <div className="h-full">{chartContent}</div>;
};

export default PositionBarChart;
