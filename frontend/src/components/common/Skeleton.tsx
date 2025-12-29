import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 基础骨架元素
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />
);

/**
 * 卡片骨架
 */
export const CardSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="bg-white rounded-xl p-4 space-y-3">
    <Skeleton className="h-5 w-1/3" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full" />
    ))}
  </div>
);

/**
 * 表格骨架
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="bg-white rounded-xl overflow-hidden">
    {/* 表头 */}
    <div className="flex gap-4 p-4 border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {/* 表体 */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 p-4 border-b border-gray-50">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Skeleton key={colIdx} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

/**
 * 列表项骨架
 */
export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3">
    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

/**
 * 列表骨架
 */
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="bg-white rounded-xl divide-y divide-gray-50">
    {Array.from({ length: count }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
);

/**
 * 统计卡片骨架
 */
export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl p-4 space-y-2">
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-8 w-2/3" />
    <Skeleton className="h-3 w-1/3" />
  </div>
);

/**
 * 图表骨架
 */
export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <div className={`bg-white rounded-xl p-4 ${height}`}>
    <Skeleton className="h-4 w-1/4 mb-4" />
    <div className="h-full flex items-end gap-2 pb-8">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="flex-1" 
          style={{ height: `${Math.random() * 60 + 20}%` } as React.CSSProperties} 
        />
      ))}
    </div>
  </div>
);

/**
 * 仪表盘骨架
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* 统计卡片 */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    {/* 图表区域 */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
    {/* 表格 */}
    <TableSkeleton rows={5} cols={5} />
  </div>
);

/**
 * Agent列表骨架
 */
export const AgentListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    ))}
  </div>
);

/**
 * 详情面板骨架
 */
export const DetailPanelSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl p-6 space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * 页面加载骨架包装器
 */
export const PageSkeleton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="animate-pulse">
    {children}
  </div>
);

export default Skeleton;
