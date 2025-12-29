import React, { useEffect, useState } from 'react';
import type { PromptTemplate, CreateTemplateRequest, UpdateTemplateRequest } from '../../types';

// 系统支持的占位符定义（按分类组织）
const PLACEHOLDER_CATEGORIES = {
  '账户': [
    { name: 'cash', label: '可用现金', description: '可用现金余额（元）' },
    { name: 'market_value', label: '持仓市值', description: '持仓总市值（元）' },
    { name: 'total_assets', label: '总资产', description: '总资产（现金+市值）' },
    { name: 'return_rate', label: '收益率', description: '累计收益率（%）' },
    { name: 'positions', label: '持仓列表', description: '当前持仓详情列表' },
    { name: 'portfolio_status', label: '持仓状态', description: '完整持仓状态信息' },
    { name: 'positions_quotes', label: '持仓股票行情', description: '当前持仓股票历史行情（markdown表格）' },
  ],
  '行情': [
    { name: 'market_data', label: '行情数据', description: '当前市场行情数据（开高低收量额）' },
    { name: 'current_market', label: '市场行情', description: '当前市场行情（同market_data）' },
    { name: 'stock_list', label: '股票列表', description: '可交易股票代码列表' },
  ],
  '技术': [
    { name: 'tech_indicators', label: '技术指标', description: '技术分析指标（MA/MACD/KDJ/RSI/BOLL等）' },
    { name: 'ma_data', label: '均线数据', description: '移动平均线数据（MA5/MA10/MA20/MA60）' },
    { name: 'macd_data', label: 'MACD指标', description: 'MACD指标数据（DIF/DEA/MACD柱）' },
    { name: 'kdj_data', label: 'KDJ指标', description: 'KDJ随机指标数据（K/D/J值）' },
    { name: 'rsi_data', label: 'RSI指标', description: '相对强弱指标RSI数据' },
    { name: 'boll_data', label: '布林带', description: '布林带指标（上轨/中轨/下轨）' },
  ],
  '资金': [
    { name: 'fund_flow', label: '资金流向', description: '个股资金流向数据（主力/散户净流入）' },
    { name: 'fund_flow_rank', label: '资金排行', description: '资金流向排行榜' },
    { name: 'north_fund', label: '北向资金', description: '北向资金（沪股通/深股通）流入数据' },
  ],
  '财务': [
    { name: 'financial_data', label: '财务数据', description: '财务数据（财报指标等）' },
    { name: 'financial_indicator', label: '财务指标', description: '财务分析指标（ROE/ROA/毛利率/净利率等）' },
    { name: 'profit_data', label: '利润数据', description: '利润表数据（营收/净利润/毛利等）' },
    { name: 'balance_data', label: '资产负债', description: '资产负债表数据' },
    { name: 'cashflow_data', label: '现金流', description: '现金流量表数据' },
  ],
  '情绪': [
    { name: 'sentiment_score', label: '情绪分数', description: '市场情绪分数（-1到1）' },
    { name: 'news_sentiment', label: '新闻情绪', description: '新闻舆情分析结果' },
    { name: 'market_sentiment', label: '市场情绪', description: '整体市场情绪指标' },
  ],
  '历史': [
    { name: 'history_trades', label: '交易历史', description: '历史交易记录' },
    { name: 'history_quotes', label: '历史行情', description: '历史K线数据' },
    { name: 'history_decisions', label: '决策历史', description: '历史AI决策记录' },
  ],
  '大盘': [
    { name: 'market_overview', label: '大盘概况', description: '大盘指数行情（上证/深证/创业板）' },
    { name: 'sector_flow', label: '板块资金', description: '行业板块资金流向' },
    { name: 'hot_stocks', label: '热门股票', description: '当日热门股票排行' },
    { name: 'hot_stocks_quotes', label: '热门股票行情', description: '热门股票近3日行情（markdown表格）' },
    { name: 'limit_up_down', label: '涨跌停统计', description: '涨停跌停股票统计' },
  ],
};

// 所有占位符的扁平列表
const ALL_PLACEHOLDERS = Object.values(PLACEHOLDER_CATEGORIES).flat();

// 分类颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  '账户': 'bg-blue-100 text-blue-700 border-blue-200',
  '行情': 'bg-green-100 text-green-700 border-green-200',
  '技术': 'bg-purple-100 text-purple-700 border-purple-200',
  '资金': 'bg-orange-100 text-orange-700 border-orange-200',
  '财务': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  '情绪': 'bg-pink-100 text-pink-700 border-pink-200',
  '历史': 'bg-gray-100 text-gray-700 border-gray-200',
  '大盘': 'bg-red-100 text-red-700 border-red-200',
};

interface TemplateEditorProps {
  isOpen: boolean;
  template?: PromptTemplate | null;
  onSave: (data: CreateTemplateRequest | UpdateTemplateRequest) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * 模板编辑器弹窗组件
 */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  isOpen,
  template,
  onSave,
  onDelete,
  onClose,
  loading = false,
  disabled = false,
}) => {
  const [name, setName] = React.useState(template?.name || '');
  const [content, setContent] = React.useState(template?.content || '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('账户');

  // Update state when template changes
  useEffect(() => {
    if (isOpen) {
      setName(template?.name || '');
      setContent(template?.content || '');
      setError(null);
    }
  }, [isOpen, template]);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入模板名称');
      return;
    }
    if (!content.trim()) {
      setError('请输入模板内容');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (template) {
        await onSave({
          name: name.trim(),
          content: content.trim(),
        } as UpdateTemplateRequest);
      } else {
        await onSave({
          name: name.trim(),
          content: content.trim(),
        } as CreateTemplateRequest);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete || !template) return;

    if (!window.confirm(`确定要删除模板 "${template.name}" 吗？`)) {
      return;
    }

    try {
      setSaving(true);
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setSaving(false);
    }
  };

  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholderName: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = `{{${placeholderName}}}`;
      const newContent = content.substring(0, start) + text + content.substring(end);
      setContent(newContent);
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    } else {
      setContent(prev => prev + `{{${placeholderName}}}`);
    }
  };

  // Extract placeholders for display
  const extractPlaceholders = (text: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const placeholders = extractPlaceholders(content);

  // Get placeholder info by name
  const getPlaceholderInfo = (name: string) => {
    return ALL_PLACEHOLDERS.find(p => p.name === name);
  };

  // Get category for a placeholder
  const getPlaceholderCategory = (name: string): string | null => {
    for (const [category, items] of Object.entries(PLACEHOLDER_CATEGORIES)) {
      if (items.some(p => p.name === name)) {
        return category;
      }
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-800 rounded-[7px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {template ? '编辑模板' : '创建模板'}
            </h2>
            {template && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                版本 {template.version} • 更新: {new Date(template.updated_at).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Placeholder Panel */}
          <div className="w-64 border-r border-gray-100 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                可用占位符
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                点击插入到模板
              </p>
              
              {Object.entries(PLACEHOLDER_CATEGORIES).map(([category, items]) => (
                <div key={category} className="mb-2">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[category]?.split(' ')[0] || 'bg-gray-300'}`} />
                      {category}
                      <span className="text-gray-400">({items.length})</span>
                    </span>
                    <svg 
                      className={`w-3.5 h-3.5 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedCategory === category && (
                    <div className="mt-1 space-y-0.5 pl-1">
                      {items.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => insertPlaceholder(p.name)}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded border transition-colors hover:shadow-sm ${CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                          title={p.description}
                        >
                          <div className="font-medium">{p.label}</div>
                          <div className="text-[10px] opacity-70 truncate">{p.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error message */}
            {error && (
              <div className="p-3 bg-loss-red/10 text-loss-red rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Name input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">模板名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="输入模板名称"
                disabled={loading}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white dark:bg-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
              />
            </div>

            {/* Content textarea */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">模板内容</label>
              <textarea
                id="template-content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setError(null);
                }}
                placeholder="输入提示词模板内容，使用 {{占位符}} 格式插入变量..."
                disabled={loading}
                rows={16}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white dark:bg-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none font-mono text-sm resize-none flex-1"
              />
            </div>

            {/* Detected Placeholders */}
            {placeholders.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  已使用的占位符 ({placeholders.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {placeholders.map((placeholder, index) => {
                    const info = getPlaceholderInfo(placeholder);
                    const category = getPlaceholderCategory(placeholder);
                    const isValid = !!info;
                    const colorClass = category ? CATEGORY_COLORS[category] : '';
                    
                    return (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${
                          isValid 
                            ? colorClass || 'bg-profit-green/10 text-profit-green border-profit-green/20'
                            : 'bg-warning-orange/10 text-warning-orange border-warning-orange/20'
                        }`}
                        title={info?.description || '未知占位符'}
                      >
                        <span className="font-medium">{info?.label || placeholder}</span>
                        <span className="opacity-60 font-mono text-[10px]">{`{{${placeholder}}}`}</span>
                        {!isValid && <span>⚠️</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div>
            {template && onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving || loading || disabled}
                className="px-4 py-2 text-sm text-loss-red hover:bg-loss-red/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={disabled ? '需要登录才能执行此操作' : ''}
              >
                删除模板
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-[7px] text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving || disabled}
              className="px-5 py-2 bg-space-black text-white rounded-[7px] font-medium hover:bg-graphite transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={disabled ? '需要登录才能执行此操作' : ''}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
