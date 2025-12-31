import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui';
import { MCPCard, MCPDetailDrawer, MCPFormModal, ToolTestPanel } from '../components/mcp';
import { mcpApi } from '../services/api';
import { useToast, useAuth } from '../contexts';
import type { MCPServer, MCPStats, MCPTool, MCPServerCreate, MCPServerUpdate } from '../types';

/**
 * MCP市场页面
 * 包含统计卡片、搜索栏、MCP卡片列表
 * Requirements: 8.1, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */
const MCPMarketplace: React.FC = () => {
  // State
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [stats, setStats] = useState<MCPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;
  
  // Selected server for detail drawer
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  
  // Form modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  
  // Tool test panel state
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testingTool, setTestingTool] = useState<MCPTool | null>(null);
  const [testingServerId, setTestingServerId] = useState<number>(0);
  
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build search params
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      
      if (searchText.trim()) {
        params.display_name = searchText.trim();
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      // Load servers and stats in parallel
      const [serversResponse, statsResponse] = await Promise.all([
        mcpApi.list(params),
        mcpApi.getStats(),
      ]);

      setServers(serversResponse.servers);
      setTotal(serversResponse.total);
      setTotalPages(serversResponse.total_pages);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh stats only
  const refreshStats = useCallback(async () => {
    try {
      const statsResponse = await mcpApi.getStats();
      setStats(statsResponse);
    } catch {
      // Silently fail stats refresh
    }
  }, []);

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  }, [loadData]);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((status: 'all' | 'enabled' | 'disabled') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  // Handle card click - open detail drawer
  const handleCardClick = useCallback((server: MCPServer) => {
    setSelectedServer(server);
  }, []);

  // Handle edit
  const handleEdit = useCallback((server: MCPServer) => {
    setEditingServer(server);
    setFormModalOpen(true);
    setSelectedServer(null);
  }, []);

  // Handle create
  const handleCreate = useCallback(() => {
    setEditingServer(null);
    setFormModalOpen(true);
  }, []);

  // Handle form submit
  const handleFormSubmit = useCallback(async (data: MCPServerCreate | MCPServerUpdate) => {
    if (editingServer) {
      await mcpApi.update(editingServer.server_id, data as MCPServerUpdate);
      toast.success('MCP服务更新成功');
    } else {
      await mcpApi.create(data as MCPServerCreate);
      toast.success('MCP服务创建成功');
    }
    loadData();
    refreshStats();
  }, [editingServer, loadData, refreshStats, toast]);

  // Handle toggle status
  const handleToggleStatus = useCallback(async (server: MCPServer) => {
    try {
      await mcpApi.updateStatus(server.server_id, { is_enabled: !server.is_enabled });
      toast.success(server.is_enabled ? '已停用' : '已启用');
      loadData();
      refreshStats();
      // Update selected server if it's the same
      if (selectedServer?.server_id === server.server_id) {
        setSelectedServer(prev => prev ? { ...prev, is_enabled: !prev.is_enabled } : null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  }, [loadData, refreshStats, selectedServer, toast]);

  // Handle test tool
  const handleTestTool = useCallback((tool: MCPTool, serverId: number) => {
    setTestingTool(tool);
    setTestingServerId(serverId);
    setTestPanelOpen(true);
  }, []);

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white/60 rounded-[7px] p-5 border border-gray-100/60 animate-pulse">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gray-200" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
          <div className="flex gap-2 mb-4">
            <div className="h-6 bg-gray-200 rounded w-16" />
            <div className="h-6 bg-gray-200 rounded w-16" />
          </div>
          <div className="pt-3 border-t border-gray-100/60">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info-blue/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-info-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">总MCP服务</div>
                <div className="text-2xl font-bold text-space-black">
                  {stats?.total_servers ?? '-'}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-profit-green/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-profit-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">已启用</div>
                <div className="text-2xl font-bold text-space-black">
                  {stats?.enabled_servers ?? '-'}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning-orange/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">总调用量</div>
                <div className="text-2xl font-bold text-space-black">
                  {stats?.total_use_count?.toLocaleString() ?? '-'}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Search & Filter Bar */}
        <GlassCard className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="搜索MCP服务..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-space-black/20 focus:border-gray-300"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-space-black text-white rounded-lg text-sm font-medium hover:bg-graphite transition-colors"
              >
                搜索
              </button>
            </form>

            {/* Filter & Actions */}
            <div className="flex gap-2 items-center">
              {/* Status Filter */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(['all', 'enabled', 'disabled'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilterChange(status)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-white text-space-black shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {status === 'all' && '全部'}
                    {status === 'enabled' && '已启用'}
                    {status === 'disabled' && '已停用'}
                  </button>
                ))}
              </div>

              {/* Create Button */}
              {isAuthenticated && (
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-info-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Error State */}
        {error && (
          <GlassCard className="p-6">
            <div className="text-center">
              <div className="text-loss-red mb-4">加载失败</div>
              <p className="text-gray-500 mb-4">{error}</p>
              <button onClick={loadData} className="text-info-blue hover:underline">重试</button>
            </div>
          </GlassCard>
        )}

        {/* Loading State */}
        {loading && !error && renderSkeleton()}

        {/* Empty State */}
        {!loading && !error && servers.length === 0 && (
          <GlassCard className="p-12">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">暂无MCP服务</h3>
              <p className="text-gray-500 mb-4">
                {searchText || statusFilter !== 'all' 
                  ? '没有找到匹配的MCP服务，请尝试其他搜索条件' 
                  : '点击"创建"按钮添加第一个MCP服务'
                }
              </p>
              {isAuthenticated && !searchText && statusFilter === 'all' && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-info-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建MCP服务
                </button>
              )}
            </div>
          </GlassCard>
        )}

        {/* Server Cards Grid */}
        {!loading && !error && servers.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {servers.map((server) => (
                <MCPCard
                  key={server.server_id}
                  server={server}
                  isSelected={selectedServer?.server_id === server.server_id}
                  onClick={() => handleCardClick(server)}
                  onEdit={isAuthenticated ? () => handleEdit(server) : undefined}
                  onToggleStatus={isAuthenticated ? () => handleToggleStatus(server) : undefined}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500">
                  第 {page} / {totalPages} 页，共 {total} 条
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      <MCPDetailDrawer
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
        onEdit={isAuthenticated && selectedServer ? () => handleEdit(selectedServer) : undefined}
        onToggleStatus={isAuthenticated && selectedServer ? () => handleToggleStatus(selectedServer) : undefined}
        onTestTool={selectedServer ? (tool) => handleTestTool(tool, selectedServer.server_id) : undefined}
      />

      {/* Form Modal */}
      <MCPFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingServer(null);
        }}
        onSubmit={handleFormSubmit}
        server={editingServer}
      />

      {/* Tool Test Panel */}
      <ToolTestPanel
        isOpen={testPanelOpen}
        onClose={() => {
          setTestPanelOpen(false);
          setTestingTool(null);
        }}
        serverId={testingServerId}
        tool={testingTool}
      />
    </div>
  );
};

export default MCPMarketplace;
