import React, { useMemo } from 'react';
import { GlassCard, Label, StatusLabel } from '../ui';
import type { PromptTemplate } from '../../types';

interface TemplatePreviewProps {
  template: PromptTemplate | null;
  sampleData?: Record<string, string>;
  onEdit?: () => void;
  disabled?: boolean;
}

// 占位符中文名称映射
const PLACEHOLDER_LABELS: Record<string, string> = {
  // 账户资产类
  cash: '可用现金',
  market_value: '持仓市值',
  total_assets: '总资产',
  return_rate: '收益率',
  positions: '持仓列表',
  portfolio_status: '持仓状态',
  positions_quotes: '持仓股票行情',
  // 行情数据类
  market_data: '行情数据',
  current_market: '市场行情',
  stock_list: '股票列表',
  hot_stocks_quotes: '热门股票行情',
  // 技术指标类
  tech_indicators: '技术指标',
  ma_data: '均线数据',
  macd_data: 'MACD指标',
  kdj_data: 'KDJ指标',
  rsi_data: 'RSI指标',
  boll_data: '布林带',
  // 资金流向类
  fund_flow: '资金流向',
  fund_flow_rank: '资金排行',
  north_fund: '北向资金',
  // 财务数据类
  financial_data: '财务数据',
  financial_indicator: '财务指标',
  profit_data: '利润数据',
  balance_data: '资产负债',
  cashflow_data: '现金流',
  // 市场情绪类
  sentiment_score: '情绪分数',
  news_sentiment: '新闻情绪',
  market_sentiment: '市场情绪',
  // 历史数据类
  history_trades: '交易历史',
  history_quotes: '历史行情',
  history_decisions: '决策历史',
  // 市场概况类
  market_overview: '大盘概况',
  sector_flow: '板块资金',
  hot_stocks: '热门股票',
  limit_up_down: '涨跌停统计',
  // 系统时间类
  current_time: '当前时间',
  current_date: '当前日期',
  current_weekday: '星期',
  is_trading_day: '是否交易日',
  // 涨停板数据类
  limit_up_order_amount: '封单金额',
  queue_amount: '排队金额',
  queue_position: '排队位置',
  // MCP工具类
  mcp_tools: 'MCP工具列表',
};

// Default sample data for preview
const DEFAULT_SAMPLE_DATA: Record<string, string> = {
  cash: '15000.00',
  market_value: '10000.00',
  total_assets: '25000.00',
  return_rate: '25.00',
  positions: JSON.stringify([
    { stock_code: '600000', name: '浦发银行', shares: 100, avg_cost: 8.30, current_price: 8.52, profit: 22.00 },
    { stock_code: '000001', name: '平安银行', shares: 200, avg_cost: 12.00, current_price: 12.50, profit: 100.00 },
  ], null, 2),
  market_data: JSON.stringify({
    '600000': { name: '浦发银行', close: 8.52, change_pct: 1.79, volume: 12345678 },
    '000001': { name: '平安银行', close: 12.50, change_pct: -0.5, volume: 8765432 },
  }, null, 2),
  current_market: JSON.stringify({
    '600000': { name: '浦发银行', close: 8.52, change_pct: 1.79 },
  }, null, 2),
  history_trades: JSON.stringify([
    { date: '2024-01-15', action: 'BUY', stock_code: '600000', quantity: 100, price: 8.30 },
    { date: '2024-01-10', action: 'SELL', stock_code: '000001', quantity: 200, price: 12.50 },
  ], null, 2),
  financial_data: JSON.stringify({
    revenue: '1234.56亿',
    net_profit: '456.78亿',
    pe_ratio: 5.2,
    pb_ratio: 0.45,
    roe: 12.5,
  }, null, 2),
  portfolio_status: JSON.stringify({
    cash: 15000.00,
    total_assets: 25000.00,
    market_value: 10000.00,
    return_rate: 25.00,
    positions: [
      { stock_code: '600000', shares: 100, avg_cost: 8.30, current_price: 8.52 },
    ],
  }, null, 2),
  sentiment_score: '0.65',
  // 技术指标示例
  tech_indicators: JSON.stringify({
    ma5: 8.45, ma10: 8.38, ma20: 8.25, ma60: 8.10,
    macd: { dif: 0.12, dea: 0.08, macd: 0.08 },
    kdj: { k: 65.2, d: 58.3, j: 79.0 },
    rsi: { rsi6: 58.5, rsi12: 52.3, rsi24: 48.7 },
  }, null, 2),
  ma_data: JSON.stringify({ ma5: 8.45, ma10: 8.38, ma20: 8.25, ma60: 8.10 }, null, 2),
  macd_data: JSON.stringify({ dif: 0.12, dea: 0.08, macd: 0.08 }, null, 2),
  kdj_data: JSON.stringify({ k: 65.2, d: 58.3, j: 79.0 }, null, 2),
  rsi_data: JSON.stringify({ rsi6: 58.5, rsi12: 52.3, rsi24: 48.7 }, null, 2),
  boll_data: JSON.stringify({ upper: 8.85, middle: 8.52, lower: 8.19 }, null, 2),
  // 资金流向示例
  fund_flow: JSON.stringify({
    main_net_inflow: 1234567.89,
    retail_net_inflow: -567890.12,
    super_large_inflow: 500000,
    large_inflow: 300000,
  }, null, 2),
  fund_flow_rank: JSON.stringify([
    { stock_code: '600000', name: '浦发银行', net_inflow: 1234567 },
    { stock_code: '000001', name: '平安银行', net_inflow: 987654 },
  ], null, 2),
  north_fund: JSON.stringify({
    sh_net_buy: 12.5,
    sz_net_buy: 8.3,
    total_net_buy: 20.8,
    unit: '亿元',
  }, null, 2),
  // 财务指标示例
  financial_indicator: JSON.stringify({
    roe: 12.5, roa: 1.2, gross_margin: 35.6, net_margin: 28.3,
    debt_ratio: 45.2, current_ratio: 1.8,
  }, null, 2),
  profit_data: JSON.stringify({
    revenue: 1234.56, net_profit: 456.78, gross_profit: 567.89,
    unit: '亿元',
  }, null, 2),
  balance_data: JSON.stringify({
    total_assets: 5678.90, total_liabilities: 2345.67, equity: 3333.23,
    unit: '亿元',
  }, null, 2),
  cashflow_data: JSON.stringify({
    operating: 234.56, investing: -123.45, financing: -56.78,
    unit: '亿元',
  }, null, 2),
  // 市场情绪示例
  news_sentiment: JSON.stringify({
    positive: 15, negative: 5, neutral: 10,
    score: 0.5, keywords: ['利好', '增长', '突破'],
  }, null, 2),
  market_sentiment: JSON.stringify({
    fear_greed_index: 65,
    market_mood: '偏乐观',
    trading_activity: '活跃',
  }, null, 2),
  // 历史数据示例
  history_quotes: JSON.stringify([
    { date: '2024-01-15', open: 8.30, high: 8.55, low: 8.25, close: 8.52, volume: 12345678 },
    { date: '2024-01-14', open: 8.20, high: 8.35, low: 8.15, close: 8.30, volume: 10234567 },
  ], null, 2),
  history_decisions: JSON.stringify([
    { date: '2024-01-15', decision: 'buy', stock_code: '600000', reason: '技术面向好' },
    { date: '2024-01-10', decision: 'hold', reason: '观望等待' },
  ], null, 2),
  // 市场概况示例
  stock_list: JSON.stringify(['600000', '000001', '600036', '601318'], null, 2),
  market_overview: JSON.stringify({
    sh_index: { value: 3150.25, change_pct: 0.85 },
    sz_index: { value: 10250.36, change_pct: 1.12 },
    cyb_index: { value: 2050.18, change_pct: 1.56 },
  }, null, 2),
  sector_flow: JSON.stringify({
    '银行': { net_inflow: 5.6, change_pct: 1.2 },
    '科技': { net_inflow: -2.3, change_pct: -0.5 },
  }, null, 2),
  hot_stocks: JSON.stringify([
    { stock_code: '600000', name: '浦发银行', change_pct: 5.5, volume: 50000000 },
    { stock_code: '000001', name: '平安银行', change_pct: 4.2, volume: 40000000 },
  ], null, 2),
  hot_stocks_quotes: `## 热门股票近3日行情

| 股票代码 | 股票名称 | 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅 | 成交量(万手) |
|----------|----------|------|------|------|------|------|--------|--------------|
| 600000 | 浦发银行 | 12-25 | 10.50 | 10.80 | 10.40 | 10.65 | +1.43% | 1234.5 |
| 600000 | 浦发银行 | 12-26 | 10.65 | 10.90 | 10.55 | 10.75 | +0.94% | 1456.2 |
| 600000 | 浦发银行 | 12-27 | 10.75 | 11.00 | 10.70 | 10.95 | +1.86% | 1678.3 |`,
  positions_quotes: `## 持仓股票历史行情

### 600000 浦发银行
持仓: 100股, 成本价: 10.50

| 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅 | 成交量(万手) |
|------|------|------|------|------|--------|--------------|
| 12-20 | 10.20 | 10.45 | 10.15 | 10.35 | +1.47% | 1123.4 |
| 12-23 | 10.35 | 10.55 | 10.30 | 10.50 | +1.45% | 1234.5 |
| 12-24 | 10.50 | 10.70 | 10.45 | 10.65 | +1.43% | 1345.6 |
| 12-25 | 10.65 | 10.85 | 10.60 | 10.80 | +1.41% | 1456.7 |
| 12-26 | 10.80 | 11.00 | 10.75 | 10.95 | +1.39% | 1567.8 |`,
  limit_up_down: JSON.stringify({
    limit_up_count: 45,
    limit_down_count: 12,
    up_count: 2500,
    down_count: 1800,
  }, null, 2),
  // 系统时间示例
  current_time: '10:30:25',
  current_date: '2024-12-30',
  current_weekday: '星期一',
  is_trading_day: '是',
  // 涨停板数据示例
  limit_up_order_amount: '2.5',
  queue_amount: '0.8亿',
  queue_position: '约32%位置',
  // MCP工具示例
  mcp_tools: `## 可用MCP工具

### 股票数据服务 (stock-data-mcp)
| 工具名称 | 描述 |
|----------|------|
| get_stock_quote | 获取股票实时行情 |
| get_stock_history | 获取股票历史数据 |
| get_market_overview | 获取市场概况 |

### 交易服务 (trading-mcp)
| 工具名称 | 描述 |
|----------|------|
| place_order | 下单交易 |
| cancel_order | 撤销订单 |
| get_positions | 获取持仓信息 |`,
};

/**
 * 模板预览组件
 * 展示模板渲染后的效果，并检测语法错误
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  sampleData = DEFAULT_SAMPLE_DATA,
  onEdit,
  disabled = false,
}) => {
  // Parse and render template
  const { renderedContent, errors, placeholders } = useMemo(() => {
    if (!template) {
      return { renderedContent: '', errors: [], placeholders: [] };
    }

    const content = template.content;
    const foundErrors: string[] = [];
    const foundPlaceholders: string[] = [];

    // Find all placeholders
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = placeholderRegex.exec(content)) !== null) {
      foundPlaceholders.push(match[1]);
    }

    // Check for unmatched braces
    const openBraces = (content.match(/\{\{/g) || []).length;
    const closeBraces = (content.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      foundErrors.push(`占位符语法错误: 发现 ${openBraces} 个 "{{" 和 ${closeBraces} 个 "}}"`);
    }

    // Check for invalid placeholder syntax
    const invalidPlaceholders = content.match(/\{\{[^}]*[^a-zA-Z0-9_}][^}]*\}\}/g);
    if (invalidPlaceholders) {
      foundErrors.push(`无效的占位符名称: ${invalidPlaceholders.join(', ')}`);
    }

    // Render template with sample data
    let rendered = content;
    const uniquePlaceholders = [...new Set(foundPlaceholders)];
    
    for (const placeholder of uniquePlaceholders) {
      const value = sampleData[placeholder];
      if (value !== undefined) {
        rendered = rendered.replace(
          new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'),
          value
        );
      } else {
        // Mark unresolved placeholders
        const label = PLACEHOLDER_LABELS[placeholder] || placeholder;
        foundErrors.push(`未定义的占位符: {{${placeholder}}} (${label})`);
      }
    }

    return {
      renderedContent: rendered,
      errors: foundErrors,
      placeholders: uniquePlaceholders,
    };
  }, [template, sampleData]);

  if (!template) {
    return (
      <GlassCard className="p-6 rounded-[10px] h-full min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">选择一个模板查看预览</p>
          <p className="text-xs text-gray-400">预览将展示模板渲染后的效果</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 rounded-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Label>模板预览</Label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{template.name} (v{template.version})</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusLabel status={errors.length > 0 ? 'warning' : 'profit'}>
            {errors.length > 0 ? `${errors.length} 个问题` : '语法正确'}
          </StatusLabel>
          {onEdit && (
            <button 
              onClick={onEdit} 
              className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors"
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-warning-orange/10 rounded-xl">
          <Label className="text-warning-orange mb-2 block">语法问题</Label>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-warning-orange flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Placeholders summary */}
      {placeholders.length > 0 && (
        <div className="mb-4">
          <Label className="mb-2 block">占位符 ({placeholders.length})</Label>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((placeholder, index) => {
              const hasValue = sampleData[placeholder] !== undefined;
              const label = PLACEHOLDER_LABELS[placeholder];
              return (
                <span
                  key={index}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1
                    text-xs font-medium
                    rounded-lg border
                    ${hasValue 
                      ? 'bg-profit-green/10 text-profit-green border-profit-green/20' 
                      : 'bg-warning-orange/10 text-warning-orange border-warning-orange/20'
                    }
                  `}
                  title={`{{${placeholder}}}`}
                >
                  <span>{label || placeholder}</span>
                  <span className="opacity-50 font-mono text-[10px]">{placeholder}</span>
                  {hasValue ? <span>✓</span> : <span>?</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Rendered preview */}
      <div>
        <Label className="mb-2 block">模拟渲染结果</Label>
        <div className="
          bg-cold-gray dark:bg-gray-900
          border border-gray-200/60 dark:border-gray-700
          rounded-xl 
          p-4 
          max-h-[400px] 
          overflow-auto
        ">
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono text-left">
            {renderedContent}
          </pre>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          预览使用示例数据渲染，实际运行时将使用真实市场数据
        </p>
      </div>
    </GlassCard>
  );
};

export default TemplatePreview;
