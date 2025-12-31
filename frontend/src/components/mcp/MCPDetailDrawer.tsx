import React, { useState, useEffect, useCallback } from 'react';
import { StatusLabel } from '../ui';
import type { MCPServer, MCPTool } from '../../types';

export interface MCPDetailDrawerProps {
  server: MCPServer | null;
  onClose: () => void;
  onEdit?: () => void;
  onToggleStatus?: () => void;
  onTestTool?: (tool: MCPTool) => void;
}

// 标签类型
type TabType = 'overview' | 'tools';

// 标签配置
const TAB_CONFIG: { key: TabType; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'tools', label: '工具清单' },
];

/**
 * MCP服务详情抽屉组件
 * 右侧滑出，包含"概览"和"工具清单"两个标签页
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export const MCPDetailDrawer: React.FC<MCPDetailDrawerProps> = ({ 
  server, 
  onClose,
  onEdit,
  onToggleStatus,
  onTestTool,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // 点击遮罩关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // ESC键关闭 & 阻止页面滚动
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (server) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [server, onClose]);

  // 重置状态
  useEffect(() => {
    if (server) {
      setActiveTab('overview');
      setExpandedTools(new Set());
    }
  }, [server]);

  // 切换工具展开状态
  const toggleToolExpand = useCallback((toolName: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  }, []);

  if (!server) return null;

  // 解析标签
  const tags = server.tag ? server.tag.split(',').map(t => t.trim()).filter(Boolean) : [];

  // 状态配置
  const statusConfig = server.is_enabled 
    ? { label: '已启用', statusType: 'profit' as const }
    : { label: '已停用', statusType: 'neutral' as const };

  // 渲染概览标签页
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* 基础信息 */}
      <div className="bg-white/60 rounded-lg p-4 border border-gray-100/60">
        <h3 className="text-sm font-semibold text-space-black mb-4">基础信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">唯一标识</div>
            <div className="text-sm text-space-black font-mono">{server.qualified_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">显示名称</div>
            <div className="text-sm text-space-black">{server.display_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">创建者</div>
            <div className="text-sm text-space-black">{server.creator || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">类型</div>
            <div className="text-sm text-space-black">{server.is_domestic ? '国内' : '国外'}</div>
          </div>
        </div>
        {server.description && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">描述</div>
            <div className="text-sm text-gray-600">{server.description}</div>
          </div>
        )}
        {server.introduction && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">详细介绍</div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{server.introduction}</div>
          </div>
        )}
        {tags.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">标签</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-lg bg-info-blue/10 text-xs text-info-blue"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 连接配置 */}
      {server.connections.length > 0 && (
        <div className="bg-white/60 rounded-lg p-4 border border-gray-100/60">
          <h3 className="text-sm font-semibold text-space-black mb-4">连接配置</h3>
          <div className="space-y-3">
            {server.connections.map((conn, index) => (
              <div key={conn.connection_id || index} className="bg-gray-50/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-gray-200 text-xs font-medium text-gray-700">
                    {conn.connection_type}
                  </span>
                </div>
                {conn.command && (
                  <div className="mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">命令</div>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                      {conn.command}
                    </code>
                  </div>
                )}
                {conn.args && conn.args.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">参数</div>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                      {conn.args.join(' ')}
                    </code>
                  </div>
                )}
                {conn.env && Object.keys(conn.env).length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">环境变量</div>
                    <div className="space-y-1">
                      {Object.entries(conn.env).map(([key, value]) => (
                        <div key={key} className="text-xs font-mono">
                          <span className="text-gray-500">{key}=</span>
                          <span className="text-gray-700">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 统计数据 */}
      <div className="bg-white/60 rounded-lg p-4 border border-gray-100/60">
        <h3 className="text-sm font-semibold text-space-black mb-4">统计数据</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-space-black">{server.tools.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">工具数量</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-space-black">{server.use_count.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">调用次数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-space-black">{server.connections.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">连接配置</div>
          </div>
        </div>
      </div>

      {/* 其他信息 */}
      <div className="bg-white/60 rounded-lg p-4 border border-gray-100/60">
        <h3 className="text-sm font-semibold text-space-black mb-4">其他信息</h3>
        <div className="grid grid-cols-2 gap-4">
          {server.package_url && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">包地址</div>
              <a 
                href={server.package_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-info-blue hover:underline truncate block"
              >
                {server.package_url}
              </a>
            </div>
          )}
          {server.repository_id && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">仓库ID</div>
              <div className="text-sm text-space-black font-mono">{server.repository_id}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">创建时间</div>
            <div className="text-sm text-space-black">
              {new Date(server.created_at).toLocaleString('zh-CN')}
            </div>
          </div>
          {server.updated_at && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">更新时间</div>
              <div className="text-sm text-space-black">
                {new Date(server.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 渲染工具清单标签页
  const renderToolsTab = () => (
    <div className="space-y-3">
      {server.tools.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p>暂无工具</p>
        </div>
      ) : (
        server.tools.map((tool) => (
          <div 
            key={tool.tool_id || tool.name}
            className="bg-white/60 rounded-lg border border-gray-100/60 overflow-hidden"
          >
            {/* 工具头部 */}
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleToolExpand(tool.name)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-space-black">{tool.name}</h4>
                    {tool.translation && (
                      <span className="text-xs text-gray-400">({tool.translation})</span>
                    )}
                  </div>
                  {tool.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tool.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {onTestTool && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTestTool(tool);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-info-blue/10 text-info-blue text-xs font-medium hover:bg-info-blue/20 transition-colors"
                    >
                      测试
                    </button>
                  )}
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedTools.has(tool.name) ? 'rotate-180' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 工具详情（可折叠） */}
            {expandedTools.has(tool.name) && tool.input_schema && (
              <div className="px-4 pb-4 border-t border-gray-100/60">
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">输入参数 Schema</div>
                  <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto">
                    {JSON.stringify(tool.input_schema, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
      onClick={handleBackdropClick}
      data-testid="mcp-detail-drawer-backdrop"
    >
      {/* 抽屉内容 */}
      <div 
        className="absolute right-0 top-0 h-full w-[60%] max-w-3xl bg-ios-gray shadow-2xl overflow-hidden animate-slide-in-right"
        data-testid="mcp-detail-drawer"
      >
        {/* 头部区域 - 固定 */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
          {/* 关闭按钮 + 服务头部信息 */}
          <div className="flex items-start p-4">
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors mr-3"
              data-testid="close-button"
              title="关闭"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 服务信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                {/* Logo */}
                {server.logo ? (
                  <img 
                    src={server.logo} 
                    alt={server.display_name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-info-blue/20 to-info-blue/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-info-blue font-bold text-xl">
                      {server.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-space-black truncate">{server.display_name}</h2>
                    <StatusLabel status={statusConfig.statusType}>
                      {statusConfig.label}
                    </StatusLabel>
                  </div>
                  {server.creator && (
                    <p className="text-sm text-gray-400 mt-0.5">by {server.creator}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 ml-4">
              {onToggleStatus && (
                <button
                  onClick={onToggleStatus}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${server.is_enabled 
                      ? 'bg-warning-orange/10 text-warning-orange hover:bg-warning-orange/20' 
                      : 'bg-profit-green/10 text-profit-green hover:bg-profit-green/20'
                    }
                  `}
                >
                  {server.is_enabled ? '停用' : '启用'}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-3 py-1.5 rounded-lg bg-space-black text-white text-sm font-medium hover:bg-graphite transition-colors"
                >
                  编辑
                </button>
              )}
            </div>
          </div>

          {/* Tab菜单 */}
          <div className="px-6 pb-0">
            <div className="flex gap-1 border-b border-gray-200" data-testid="tab-menu">
              {TAB_CONFIG.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-space-black text-space-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                  {tab.key === 'tools' && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs">
                      {server.tools.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="h-[calc(100%-140px)] overflow-y-auto p-6" data-testid="drawer-content">
          {activeTab === 'overview' ? renderOverviewTab() : renderToolsTab()}
        </div>
      </div>
    </div>
  );
};

export default MCPDetailDrawer;
