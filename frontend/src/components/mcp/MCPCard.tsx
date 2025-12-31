import React from 'react';
import { StatusLabel } from '../ui';
import type { MCPServer } from '../../types';

interface MCPCardProps {
  server: MCPServer;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onToggleStatus?: () => void;
}

/**
 * MCP服务卡片组件
 * 以卡片形式展示单个MCP服务的信息和状态
 * Requirements: 8.1, 8.2
 */
export const MCPCard: React.FC<MCPCardProps> = ({ 
  server, 
  isSelected, 
  onClick,
  onEdit,
  onToggleStatus,
}) => {
  // 解析标签
  const tags = server.tag ? server.tag.split(',').map(t => t.trim()).filter(Boolean) : [];

  // 状态配置
  const getStatusConfig = (isEnabled: boolean): { label: string; statusType: 'profit' | 'loss' | 'neutral' | 'warning' | 'info' } => {
    return isEnabled 
      ? { label: '已启用', statusType: 'profit' }
      : { label: '已停用', statusType: 'neutral' };
  };

  const statusConfig = getStatusConfig(server.is_enabled);

  // 处理编辑按钮点击
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  // 处理状态切换按钮点击
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStatus?.();
  };

  return (
    <div 
      className={`
        bg-white/60 rounded-[7px] p-5 border transition-all duration-200
        ${isSelected 
          ? 'border-space-black/30 ring-2 ring-space-black/10 shadow-lg' 
          : 'border-gray-100/60 hover:shadow-md hover:bg-white/80'
        }
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
    >
      {/* Header with logo, name and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
          {/* Logo */}
          {server.logo ? (
            <img 
              src={server.logo} 
              alt={server.display_name}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-info-blue/20 to-info-blue/40 flex items-center justify-center flex-shrink-0">
              <span className="text-info-blue font-bold text-lg">
                {server.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-space-black truncate text-lg">{server.display_name}</h3>
            {server.creator && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">by {server.creator}</p>
            )}
          </div>
        </div>
        <StatusLabel status={statusConfig.statusType}>
          {statusConfig.label}
        </StatusLabel>
      </div>

      {/* Description */}
      {server.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {server.description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {tags.slice(0, 3).map((tag, index) => (
            <span 
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-lg bg-info-blue/10 text-xs text-info-blue"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-gray-400">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100/60">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">工具数</div>
            <div className="text-sm font-semibold text-space-black">
              {server.tools.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">调用次数</div>
            <div className="text-sm font-semibold text-space-black">
              {server.use_count.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onToggleStatus && (
            <button
              onClick={handleToggleClick}
              className={`
                px-2 py-1 rounded text-xs font-medium transition-colors
                ${server.is_enabled 
                  ? 'text-warning-orange hover:bg-warning-orange/10' 
                  : 'text-profit-green hover:bg-profit-green/10'
                }
              `}
            >
              {server.is_enabled ? '停用' : '启用'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Created date */}
      <div className="mt-2 text-[10px] text-gray-400">
        创建于 {new Date(server.created_at).toLocaleDateString('zh-CN')}
      </div>
    </div>
  );
};

export default MCPCard;
