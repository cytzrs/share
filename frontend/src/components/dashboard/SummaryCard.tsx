import React from 'react';
import { GlassCard, Label } from '../ui';

interface SummaryCardProps {
  label: string;
  value: string;
  trend?: number;
  isPercent?: boolean;
  icon?: React.ReactNode;
  subtitle?: string;
}

/**
 * 总资产概览卡片组件
 * 使用毛玻璃效果展示汇总数据
 * 支持趋势指示器和图标
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  label, 
  value, 
  trend, 
  isPercent,
  icon,
  subtitle 
}) => {
  const getTrendColor = () => {
    if (trend === undefined) return '';
    return trend >= 0 ? 'text-profit-green' : 'text-loss-red';
  };

  const getTrendBgColor = () => {
    if (trend === undefined) return '';
    return trend >= 0 ? 'bg-profit-green/10' : 'bg-loss-red/10';
  };

  return (
    <GlassCard className="p-4 rounded-[7px] hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Label className="text-xs">{label}</Label>
          <div className={`text-xl font-bold mt-1 tracking-tight ${isPercent ? getTrendColor() : 'text-space-black'}`}>
            {value}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>
          )}
          {trend !== undefined && !isPercent && (
            <div className={`inline-flex items-center gap-0.5 text-xs mt-1 px-1.5 py-0.5 rounded-lg ${getTrendColor()} ${getTrendBgColor()}`}>
              <span className="text-[10px]">
                {trend >= 0 ? '↑' : '↓'}
              </span>
              <span className="font-medium">
                {Math.abs(trend).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-info-blue/10 flex items-center justify-center text-info-blue">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default SummaryCard;
