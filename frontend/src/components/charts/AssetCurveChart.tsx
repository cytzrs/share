import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GlassCard, Label, ModelIcon } from '../ui';

// Asset curve data point interface
export interface AssetDataPoint {
  date: string;
  value: number;
  returnRate?: number;
}

// Multi-agent asset data
export interface AgentAssetData {
  agentId: string;
  agentName: string;
  llmModel: string;
  initialCash?: number;
  data: AssetDataPoint[];
  color?: string;
}

// Chart view mode
type ChartViewMode = 'assets' | 'returnRate';

interface AssetCurveChartProps {
  data?: AssetDataPoint[];
  agentsData?: AgentAssetData[];
  title?: string;
  height?: number;
  showCard?: boolean;
  showViewToggle?: boolean;
  defaultStartDate?: string;
}

// 优化的配色方案
const AGENT_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#84CC16', // Lime
];

/**
 * 资产曲线图组件
 * 使用ECharts渲染资产曲线，支持多Agent曲线展示
 */
export const AssetCurveChart: React.FC<AssetCurveChartProps> = ({ 
  data, 
  agentsData,
  title = '资产曲线',
  height = 320,
  showCard = true,
  showViewToggle = true,
  defaultStartDate = '2025-12-26',
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('assets');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 过滤日期范围内的数据
  const filteredAgentsData = useMemo(() => {
    if (!agentsData) return undefined;
    
    return agentsData.map(agent => ({
      ...agent,
      data: agent.data.filter(d => d.date >= startDate && d.date <= endDate),
    }));
  }, [agentsData, startDate, endDate]);

  const filteredData = useMemo(() => {
    if (!data) return undefined;
    return data.filter(d => d.date >= startDate && d.date <= endDate);
  }, [data, startDate, endDate]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!filteredAgentsData || filteredAgentsData.length === 0) return null;
    
    return filteredAgentsData.map((agent, index) => {
      const initialCash = agent.initialCash || (agent.data[0]?.value || 20000);
      const currentValue = agent.data[agent.data.length - 1]?.value || initialCash;
      const returnRate = ((currentValue - initialCash) / initialCash) * 100;
      
      return {
        ...agent,
        currentValue,
        returnRate,
        color: agent.color || AGENT_COLORS[index % AGENT_COLORS.length],
      };
    });
  }, [filteredAgentsData]);

  const chartOption: EChartsOption = useMemo(() => {
    if (filteredAgentsData && filteredAgentsData.length > 0) {
      const allDates = new Set<string>();
      filteredAgentsData.forEach(agent => {
        agent.data.forEach(d => allDates.add(d.date));
      });
      const dates = Array.from(allDates).sort();

      if (viewMode === 'returnRate') {
        let minRate = Infinity;
        let maxRate = -Infinity;
        
        const series = filteredAgentsData.map((agent, index) => {
          const color = agent.color || AGENT_COLORS[index % AGENT_COLORS.length];
          const initialCash = agent.initialCash || (agent.data[0]?.value || 20000);
          
          const dataMap = new Map<string, number>();
          agent.data.forEach(d => {
            const returnRate = d.returnRate !== undefined 
              ? d.returnRate 
              : ((d.value - initialCash) / initialCash) * 100;
            dataMap.set(d.date, returnRate);
            minRate = Math.min(minRate, returnRate);
            maxRate = Math.max(maxRate, returnRate);
          });
          
          const values = dates.map(date => dataMap.get(date) ?? null);
          
          return {
            name: agent.agentName,
            type: 'line' as const,
            data: values,
            smooth: 0.3,
            symbol: 'circle',
            symbolSize: 8,
            showSymbol: true,
            lineStyle: { color, width: 2.5 },
            itemStyle: { 
              color, 
              borderWidth: 2, 
              borderColor: '#fff',
              shadowColor: color + '40',
              shadowBlur: 4,
            },
            emphasis: {
              focus: 'series' as const,
              lineStyle: { width: 3 },
              scale: true,
            },
            areaStyle: {
              color: {
                type: 'linear' as const,
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: color + '20' },
                  { offset: 1, color: color + '05' },
                ],
              },
            },
          };
        });

        const range = maxRate - minRate;
        const padding = Math.max(range * 0.2, 1);
        const yMin = Math.floor((minRate - padding) * 10) / 10;
        const yMax = Math.ceil((maxRate + padding) * 10) / 10;

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
                  const valueColor = item.value >= 0 ? '#10B981' : '#EF4444';
                  const sign = item.value >= 0 ? '+' : '';
                  html += `<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
                    <span style="flex: 1; color: #3C3C43;">${item.seriesName}</span>
                    <span style="font-weight: 600; color: ${valueColor}; font-variant-numeric: tabular-nums;">${sign}${item.value.toFixed(2)}%</span>
                  </div>`;
                }
              });
              return html;
            },
          },
          legend: { show: false },
          grid: { left: 50, right: 20, bottom: 50, top: 20 },
          xAxis: {
            type: 'category',
            data: dates,
            boundaryGap: false,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              color: '#8E8E93',
              fontSize: 11,
              margin: 12,
              formatter: (value: string) => {
                const parts = value.split('-');
                return `${parts[1]}/${parts[2]}`;
              },
            },
          },
          yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              color: '#8E8E93',
              fontSize: 11,
              formatter: (value: number) => `${value.toFixed(1)}%`,
            },
            splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.04)', type: 'dashed' } },
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
          ],
          series,
        };
      }

      // 资产视图
      let minValue = Infinity;
      let maxValue = -Infinity;
      filteredAgentsData.forEach(agent => {
        agent.data.forEach(d => {
          minValue = Math.min(minValue, d.value);
          maxValue = Math.max(maxValue, d.value);
        });
      });
      const padding = (maxValue - minValue) * 0.15 || 1000;

      const series = filteredAgentsData.map((agent, index) => {
        const color = agent.color || AGENT_COLORS[index % AGENT_COLORS.length];
        const dataMap = new Map(agent.data.map(d => [d.date, d.value]));
        const values = dates.map(date => dataMap.get(date) ?? null);
        
        return {
          name: agent.agentName,
          type: 'line' as const,
          data: values,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          lineStyle: { color, width: 2.5 },
          itemStyle: { 
            color, 
            borderWidth: 2, 
            borderColor: '#fff',
            shadowColor: color + '40',
            shadowBlur: 4,
          },
          emphasis: {
            focus: 'series' as const,
            lineStyle: { width: 3 },
            scale: true,
          },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '20' },
                { offset: 1, color: color + '05' },
              ],
            },
          },
        };
      });

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
                const formattedValue = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(item.value);
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
        legend: { show: false },
        grid: { left: 55, right: 20, bottom: 50, top: 20 },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8E8E93',
            fontSize: 11,
            margin: 12,
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
            formatter: (value: number) => {
              if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
              return value.toFixed(0);
            },
          },
          splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.04)', type: 'dashed' } },
        },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series,
      };
    }

    // Single data mode
    if (!filteredData || filteredData.length === 0) return {};

    const dates = filteredData.map(d => d.date);
    const values = filteredData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = (maxValue - minValue) * 0.15 || 1000;

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
          const item = (params as Array<{ axisValue: string; value: number }>)[0];
          const formattedValue = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(item.value);
          return `<div>
            <div style="font-size: 11px; color: #8E8E93; margin-bottom: 4px;">${item.axisValue}</div>
            <div style="font-weight: 600; color: #1C1C1E;">${formattedValue}</div>
          </div>`;
        },
      },
      grid: { left: 55, right: 20, bottom: 40, top: 20 },
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
          formatter: (value: number) => {
            if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
            return value.toFixed(0);
          },
        },
        splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.04)', type: 'dashed' } },
      },
      series: [{
        name: '总资产',
        type: 'line',
        data: values,
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { color: '#6366F1', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.2)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.02)' },
            ],
          },
        },
      }],
    };
  }, [filteredData, filteredAgentsData, viewMode]);

  const hasData = (filteredData && filteredData.length > 0) || (filteredAgentsData && filteredAgentsData.length > 0 && filteredAgentsData.some(a => a.data.length > 0));

  const chartContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Label className="text-sm">{title}</Label>
          {showViewToggle && filteredAgentsData && filteredAgentsData.length > 0 && (
            <div className="flex bg-gray-100/80 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('assets')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                  viewMode === 'assets'
                    ? 'bg-white text-space-black shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                资产
              </button>
              <button
                onClick={() => setViewMode('returnRate')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                  viewMode === 'returnRate'
                    ? 'bg-white text-space-black shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                收益率
              </button>
            </div>
          )}
        </div>
        
        {/* 日期范围选择 */}
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-gray-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Agent Legend Cards */}
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {stats.map((agent) => (
            <div
              key={agent.agentId}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/80 rounded-lg border border-gray-100/60"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: agent.color }}
              />
              <span className="flex items-center gap-1.5">
                <ModelIcon modelName={agent.llmModel} size={14} />
                <span className="text-xs text-gray-700 font-medium truncate max-w-[80px]">
                  {agent.agentName}
                </span>
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  agent.returnRate >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {agent.returnRate >= 0 ? '+' : ''}{agent.returnRate.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Chart */}
      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            暂无数据
          </div>
        ) : (
          <ReactECharts
            option={chartOption}
            style={{ height: height - 80, width: '100%' }}
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

export default AssetCurveChart;
