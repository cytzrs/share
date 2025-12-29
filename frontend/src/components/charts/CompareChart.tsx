import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GlassCard, Label } from '../ui';

// Single agent's asset curve data
export interface AgentAssetCurve {
  agentId: string;
  agentName: string;
  data: Array<{
    date: string;
    value: number;
  }>;
  color?: string;
}

interface CompareChartProps {
  agents: AgentAssetCurve[];
  title?: string;
  height?: number;
  showCard?: boolean;
}

// Predefined color palette for multiple agents
const AGENT_COLORS = [
  '#007AFF', // iOS Blue
  '#34C759', // iOS Green
  '#FF9500', // iOS Orange
  '#AF52DE', // iOS Purple
  '#FF3B30', // iOS Red
  '#5AC8FA', // iOS Teal
  '#FFCC00', // iOS Yellow
  '#FF2D55', // iOS Pink
];

/**
 * 多模型对比图表组件
 * 支持多条资产曲线叠加显示，带图例和交互功能
 * 采用冷灰色调和毛玻璃效果保持视觉一致性
 */
export const CompareChart: React.FC<CompareChartProps> = ({
  agents,
  title = '多模型对比',
  height = 400,
  showCard = true,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    if (agents.length === 0) {
      return {};
    }

    // Collect all unique dates across all agents
    const allDatesSet = new Set<string>();
    agents.forEach((agent) => {
      agent.data.forEach((d) => allDatesSet.add(d.date));
    });
    const allDates = Array.from(allDatesSet).sort();

    // Calculate min/max values for Y axis
    const allValues = agents.flatMap((agent) => agent.data.map((d) => d.value));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const padding = (maxValue - minValue) * 0.1 || 1000;

    // Create series for each agent
    const series = agents.map((agent, index) => {
      // Create a map for quick lookup
      const dataMap = new Map(agent.data.map((d) => [d.date, d.value]));
      // Align data to all dates (fill gaps with null for discontinuous data)
      const alignedData = allDates.map((date) => dataMap.get(date) ?? null);

      return {
        name: agent.agentName,
        type: 'line' as const,
        data: alignedData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: {
          color: agent.color || AGENT_COLORS[index % AGENT_COLORS.length],
          width: 2,
        },
        itemStyle: {
          color: agent.color || AGENT_COLORS[index % AGENT_COLORS.length],
        },
        emphasis: {
          focus: 'series' as const,
          lineStyle: {
            width: 3,
          },
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff',
          },
        },
        connectNulls: true,
      };
    });

    return {
      animation: true,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        textStyle: {
          color: '#1C1C1E',
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          const paramArray = params as Array<{
            axisValue: string;
            value: number | null;
            seriesName: string;
            color: string;
          }>;
          if (!paramArray || paramArray.length === 0) return '';

          const date = paramArray[0].axisValue;
          let html = `<div style="padding: 8px 12px;">
            <div style="color: #666; font-size: 11px; margin-bottom: 8px; font-weight: 600;">${date}</div>`;

          // Sort by value descending
          const sortedParams = [...paramArray]
            .filter((p) => p.value !== null)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

          sortedParams.forEach((param) => {
            const formattedValue = new Intl.NumberFormat('zh-CN', {
              style: 'currency',
              currency: 'CNY',
            }).format(param.value ?? 0);

            html += `
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${param.color};"></span>
                  <span style="color: #666; font-size: 12px;">${param.seriesName}</span>
                </div>
                <span style="font-weight: 600; margin-left: 16px;">${formattedValue}</span>
              </div>`;
          });

          html += '</div>';
          return html;
        },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        left: 'center',
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 16,
        textStyle: {
          color: '#666',
          fontSize: 11,
        },
        icon: 'roundRect',
        pageIconColor: '#007AFF',
        pageIconInactiveColor: '#ccc',
        pageTextStyle: {
          color: '#666',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: allDates,
        boundaryGap: false,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (value: string) => {
            const parts = value.split('-');
            return `${parts[1]}-${parts[2]}`;
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: minValue - padding,
        max: maxValue + padding,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (value: number) => {
            if (value >= 10000) {
              return `${(value / 10000).toFixed(1)}万`;
            }
            return value.toFixed(0);
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.05)',
            type: 'dashed',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: 'slider',
          show: true,
          start: 0,
          end: 100,
          height: 20,
          bottom: 30,
          borderColor: 'transparent',
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
          fillerColor: 'rgba(0, 122, 255, 0.1)',
          handleStyle: {
            color: '#007AFF',
            borderColor: '#007AFF',
          },
          textStyle: {
            color: '#9CA3AF',
            fontSize: 10,
          },
          dataBackground: {
            lineStyle: {
              color: 'rgba(0, 122, 255, 0.3)',
            },
            areaStyle: {
              color: 'rgba(0, 122, 255, 0.1)',
            },
          },
        },
      ],
      series,
    };
  }, [agents]);

  // Calculate performance summary for each agent
  const performanceSummary = useMemo(() => {
    return agents.map((agent, index) => {
      if (agent.data.length === 0) {
        return {
          agentId: agent.agentId,
          agentName: agent.agentName,
          color: agent.color || AGENT_COLORS[index % AGENT_COLORS.length],
          startValue: 0,
          endValue: 0,
          change: 0,
          changePercent: 0,
        };
      }

      const startValue = agent.data[0].value;
      const endValue = agent.data[agent.data.length - 1].value;
      const change = endValue - startValue;
      const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

      return {
        agentId: agent.agentId,
        agentName: agent.agentName,
        color: agent.color || AGENT_COLORS[index % AGENT_COLORS.length],
        startValue,
        endValue,
        change,
        changePercent,
      };
    });
  }, [agents]);

  const chartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <Label>{title}</Label>
        <span className="text-xs text-gray-400">
          {agents.length > 0 && agents[0].data.length > 0
            ? `${agents[0].data[0].date} - ${agents[0].data[agents[0].data.length - 1].date}`
            : ''}
        </span>
      </div>

      {/* Performance Summary Cards */}
      {performanceSummary.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {performanceSummary.map((summary) => (
            <div
              key={summary.agentId}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50/50 rounded-xl"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: summary.color }}
              />
              <span className="text-xs font-medium text-gray-600 truncate max-w-[80px]">
                {summary.agentName}
              </span>
              <span
                className={`text-xs font-semibold ${summary.changePercent >= 0 ? 'text-profit-green' : 'text-loss-red'}`}
              >
                {summary.changePercent >= 0 ? '+' : ''}
                {summary.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {agents.length === 0 ? (
        <div
          className="flex items-center justify-center text-gray-400"
          style={{ height }}
        >
          请选择要对比的模型
        </div>
      ) : (
        <ReactECharts
          option={chartOption}
          style={{ height, width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      )}
    </>
  );

  if (showCard) {
    return <GlassCard className="p-6 rounded-[7px]">{chartContent}</GlassCard>;
  }

  return <div>{chartContent}</div>;
};

export default CompareChart;
