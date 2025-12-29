import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GlassCard, Label } from '../ui';

// K-line data point interface matching StockQuote
export interface KLineDataPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineDataPoint[];
  stockCode?: string;
  title?: string;
  height?: number;
  showCard?: boolean;
}

/**
 * K线图组件
 * 使用ECharts渲染专业的K线图，支持缩放和平移交互
 * 包含成交量柱状图
 * 采用冷灰色调和毛玻璃效果保持视觉一致性
 */
export const KLineChart: React.FC<KLineChartProps> = ({
  data,
  stockCode,
  title = 'K线图',
  height = 500,
  showCard = true,
}) => {
  const chartOption: EChartsOption = useMemo(() => {
    if (data.length === 0) {
      return {};
    }

    // Prepare data for candlestick chart
    const dates = data.map((d) => d.date);
    // ECharts candlestick format: [open, close, low, high]
    const candlestickData = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumeData = data.map((d) => {
      // Color volume bars based on price movement
      const isUp = d.close >= d.open;
      return {
        value: d.volume,
        itemStyle: {
          color: isUp ? '#34C759' : '#FF3B30',
          opacity: 0.7,
        },
      };
    });

    // Calculate price range for Y axis
    const allPrices = data.flatMap((d) => [d.open, d.close, d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const pricePadding = (maxPrice - minPrice) * 0.1 || 1;

    return {
      animation: true,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999',
          },
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.2)',
            type: 'dashed',
          },
        },
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
            data: number[] | { value: number };
            seriesName: string;
          }>;
          if (!paramArray || paramArray.length === 0) return '';

          const date = paramArray[0].axisValue;
          let html = `<div style="padding: 8px 12px;">
            <div style="color: #666; font-size: 11px; margin-bottom: 8px; font-weight: 600;">${date}</div>`;

          paramArray.forEach((param) => {
            if (param.seriesName === 'K线') {
              const kData = param.data as number[];
              const open = kData[1];
              const close = kData[2];
              const low = kData[3];
              const high = kData[4];
              const change = close - open;
              const changePercent = open > 0 ? ((change / open) * 100).toFixed(2) : '0.00';
              const changeColor = change >= 0 ? '#34C759' : '#FF3B30';

              html += `
                <div style="display: grid; grid-template-columns: 60px 1fr; gap: 4px; font-size: 12px;">
                  <span style="color: #999;">开盘</span><span style="font-weight: 500;">${open.toFixed(2)}</span>
                  <span style="color: #999;">收盘</span><span style="font-weight: 500; color: ${changeColor};">${close.toFixed(2)}</span>
                  <span style="color: #999;">最高</span><span style="font-weight: 500;">${high.toFixed(2)}</span>
                  <span style="color: #999;">最低</span><span style="font-weight: 500;">${low.toFixed(2)}</span>
                  <span style="color: #999;">涨跌</span><span style="font-weight: 500; color: ${changeColor};">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change >= 0 ? '+' : ''}${changePercent}%)</span>
                </div>`;
            } else if (param.seriesName === '成交量') {
              const volData = param.data as { value: number };
              const volume = volData.value;
              const formattedVolume =
                volume >= 100000000
                  ? `${(volume / 100000000).toFixed(2)}亿`
                  : volume >= 10000
                    ? `${(volume / 10000).toFixed(2)}万`
                    : volume.toString();
              html += `
                <div style="margin-top: 8px; font-size: 12px;">
                  <span style="color: #999;">成交量</span>
                  <span style="margin-left: 8px; font-weight: 500;">${formattedVolume}</span>
                </div>`;
            }
          });

          html += '</div>';
          return html;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: {
          backgroundColor: '#1C1C1E',
        },
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          top: '8%',
          height: '55%',
        },
        {
          left: '10%',
          right: '8%',
          top: '70%',
          height: '18%',
        },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            show: false,
          },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: {
            z: 100,
          },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#9CA3AF',
            fontSize: 10,
            formatter: (value: string) => {
              const parts = value.split('-');
              return `${parts[1]}-${parts[2]}`;
            },
          },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
      ],
      yAxis: [
        {
          type: 'value',
          scale: true,
          min: minPrice - pricePadding,
          max: maxPrice + pricePadding,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#9CA3AF',
            fontSize: 10,
            formatter: (value: number) => value.toFixed(2),
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(0, 0, 0, 0.05)',
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          gridIndex: 1,
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#9CA3AF',
            fontSize: 10,
            formatter: (value: number) => {
              if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
              if (value >= 10000) return `${(value / 10000).toFixed(0)}万`;
              return value.toString();
            },
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(0, 0, 0, 0.05)',
              type: 'dashed',
            },
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 50,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0, 1],
          start: 50,
          end: 100,
          top: '93%',
          height: 15,
          borderColor: 'transparent',
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
          fillerColor: 'rgba(0, 122, 255, 0.15)',
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
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: candlestickData,
          itemStyle: {
            color: '#34C759', // Up color (close > open)
            color0: '#FF3B30', // Down color (close < open)
            borderColor: '#34C759',
            borderColor0: '#FF3B30',
          },
          emphasis: {
            itemStyle: {
              borderWidth: 2,
            },
          },
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumeData,
          barWidth: '60%',
        },
      ],
    };
  }, [data]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const lastData = data[data.length - 1];
    const firstData = data[0];
    const change = lastData.close - firstData.open;
    const changePercent = firstData.open > 0 ? (change / firstData.open) * 100 : 0;
    const highestPrice = Math.max(...data.map((d) => d.high));
    const lowestPrice = Math.min(...data.map((d) => d.low));

    return {
      lastClose: lastData.close,
      change,
      changePercent,
      highestPrice,
      lowestPrice,
    };
  }, [data]);

  const chartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Label>{stockCode ? `${stockCode} ${title}` : title}</Label>
          {stats && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-space-black">
                {stats.lastClose.toFixed(2)}
              </span>
              <span
                className={`text-xs font-medium ${stats.changePercent >= 0 ? 'text-profit-green' : 'text-loss-red'}`}
              >
                {stats.changePercent >= 0 ? '+' : ''}
                {stats.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              最高: <span className="text-profit-green">{stats.highestPrice.toFixed(2)}</span>
            </span>
            <span>
              最低: <span className="text-loss-red">{stats.lowestPrice.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center text-gray-400"
          style={{ height }}
        >
          暂无数据
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

export default KLineChart;
