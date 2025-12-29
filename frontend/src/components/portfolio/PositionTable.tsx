import React from 'react';
import { GlassCard, Label, StatusLabel, SecondaryButton } from '../ui';
import type { Position } from '../../types';

// Sort configuration interface
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface PositionTableProps {
  positions: Position[];
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  filterText: string;
  onFilterChange: (text: string) => void;
  onExport: () => void;
  loading?: boolean;
}

/**
 * 持仓表格组件
 * 支持排序、筛选和盈亏颜色标识
 */
export const PositionTable: React.FC<PositionTableProps> = ({
  positions,
  sortConfig,
  onSort,
  filterText,
  onFilterChange,
  onExport,
  loading = false,
}) => {
  // Format helpers
  const formatCurrency = (value: number | string | null | undefined): string => {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (value: number | string | null | undefined): string => {
    const num = Number(value) || 0;
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // Get profit/loss color class
  const getProfitLossColor = (value: number | string | null | undefined): string => {
    const num = Number(value) || 0;
    if (num > 0) return 'text-profit-green';
    if (num < 0) return 'text-loss-red';
    return 'text-gray-500';
  };

  // Get sort indicator
  const getSortIndicator = (key: string): string => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Table columns configuration
  const columns = [
    { key: 'stock_code', label: '股票代码', sortable: true },
    { key: 'shares', label: '持仓数量', sortable: true, align: 'right' as const },
    { key: 'avg_cost', label: '成本价', sortable: true, align: 'right' as const },
    { key: 'current_price', label: '现价', sortable: true, align: 'right' as const },
    { key: 'market_value', label: '市值', sortable: true, align: 'right' as const },
    { key: 'profit_loss', label: '盈亏', sortable: true, align: 'right' as const },
    { key: 'profit_loss_rate', label: '盈亏率', sortable: true, align: 'right' as const },
  ];

  return (
    <GlassCard className="p-6 rounded-[7px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <Label>持仓列表</Label>
        
        <div className="flex items-center gap-3">
          {/* Filter Input */}
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="搜索股票代码..."
              className="pl-8 pr-4 py-2 text-sm rounded-xl bg-gray-100/50 border border-gray-200/40 focus:ring-2 focus:ring-info-blue/20 focus:border-info-blue outline-none transition-all w-40"
            />
            <svg 
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Export Button */}
          <SecondaryButton
            onClick={onExport}
            className="px-4 py-2 text-sm rounded-xl"
            disabled={positions.length === 0}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导出
            </span>
          </SecondaryButton>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200/40">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSort(col.key)}
                  className={`
                    py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.sortable ? 'cursor-pointer hover:text-space-black transition-colors' : ''}
                  `}
                >
                  {col.label}{getSortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-gray-400">
                  {filterText ? '没有匹配的持仓' : '暂无持仓'}
                </td>
              </tr>
            ) : (
              positions.map((position, index) => (
                <tr 
                  key={position.stock_code}
                  className={`
                    border-b border-gray-100/40 
                    hover:bg-gray-50/50 transition-colors
                    ${index % 2 === 0 ? 'bg-white/20' : 'bg-gray-50/20'}
                  `}
                >
                  {/* Stock Code */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-space-black">{position.stock_code}</span>
                      <StockBadge code={position.stock_code} />
                    </div>
                  </td>
                  
                  {/* Shares */}
                  <td className="py-3 px-3 text-right font-medium">
                    {position.shares.toLocaleString()}
                  </td>
                  
                  {/* Average Cost */}
                  <td className="py-3 px-3 text-right">
                    ¥{formatCurrency(position.avg_cost)}
                  </td>
                  
                  {/* Current Price */}
                  <td className="py-3 px-3 text-right">
                    <span className={getProfitLossColor((position.current_price || 0) - position.avg_cost)}>
                      ¥{formatCurrency(position.current_price || 0)}
                    </span>
                  </td>
                  
                  {/* Market Value */}
                  <td className="py-3 px-3 text-right font-medium">
                    ¥{formatCurrency(position.market_value || 0)}
                  </td>
                  
                  {/* Profit/Loss */}
                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold ${getProfitLossColor(position.profit_loss || 0)}`}>
                      {(position.profit_loss || 0) >= 0 ? '+' : ''}¥{formatCurrency(position.profit_loss || 0)}
                    </span>
                  </td>
                  
                  {/* Profit/Loss Rate */}
                  <td className="py-3 px-3 text-right">
                    <StatusLabel 
                      status={(position.profit_loss_rate || 0) >= 0 ? 'profit' : 'loss'}
                      className="text-xs"
                    >
                      {formatPercent(position.profit_loss_rate || 0)}
                    </StatusLabel>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {positions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200/40 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            共 <span className="font-semibold text-space-black">{positions.length}</span> 只股票
          </span>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">
              总市值: <span className="font-semibold text-space-black">
                ¥{formatCurrency(positions.reduce((sum, p) => sum + (p.market_value || 0), 0))}
              </span>
            </span>
            <span className="text-gray-500">
              总盈亏: <span className={`font-semibold ${getProfitLossColor(positions.reduce((sum, p) => sum + (p.profit_loss || 0), 0))}`}>
                {positions.reduce((sum, p) => sum + (p.profit_loss || 0), 0) >= 0 ? '+' : ''}
                ¥{formatCurrency(positions.reduce((sum, p) => sum + (p.profit_loss || 0), 0))}
              </span>
            </span>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

/**
 * Stock badge component to show board type
 */
const StockBadge: React.FC<{ code: string }> = ({ code }) => {
  let label = '';
  let colorClass = '';
  
  if (code.startsWith('688')) {
    label = '科创';
    colorClass = 'bg-purple-100 text-purple-600';
  } else if (code.startsWith('300') || code.startsWith('301')) {
    label = '创业';
    colorClass = 'bg-orange-100 text-orange-600';
  } else if (code.startsWith('60')) {
    label = '沪A';
    colorClass = 'bg-blue-100 text-blue-600';
  } else if (code.startsWith('00')) {
    label = '深A';
    colorClass = 'bg-green-100 text-green-600';
  }
  
  if (!label) return null;
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
      {label}
    </span>
  );
};

export default PositionTable;
