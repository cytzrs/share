import React, { useState, useEffect, useCallback } from 'react';
import type { TaskLog, TaskLogDetail, AgentResult, TaskLogStatus, AgentResultStatus } from '../../types';
import { taskApi } from '../../services/api';

interface TaskLogModalProps {
  taskId: string;
  taskName: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 任务日志详情弹窗组件
 * - 使用半透明遮罩层和居中白色卡片布局
 * - 日志列表展示：运行时间、状态、耗时
 * - 支持分页和时间筛选
 * - 点击日志行展开Agent执行详情
 * - Agent结果表格：Agent名称、状态、耗时、错误信息
 * - 状态标签使用统一样式（success: bg-green-100, failed: bg-red-100, skipped: bg-gray-100）
 */
export const TaskLogModal: React.FC<TaskLogModalProps> = ({
  taskId,
  taskName,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [logDetail, setLogDetail] = useState<TaskLogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const PAGE_SIZE = 10;

  // Load logs
  const loadLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await taskApi.getLogs(taskId, {
        page: pageNum,
        page_size: PAGE_SIZE,
      });
      setLogs(response.logs);
      setTotalPages(response.total_pages);
      setTotal(response.total);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Load log detail
  const loadLogDetail = useCallback(async (logId: number) => {
    setLoadingDetail(true);
    try {
      const detail = await taskApi.getLogDetail(taskId, logId);
      setLogDetail(detail);
    } catch (error) {
      console.error('Failed to load log detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  }, [taskId]);

  // Load logs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadLogs(1);
      setExpandedLogId(null);
      setLogDetail(null);
    }
  }, [isOpen, loadLogs]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle row click to expand/collapse
  const handleRowClick = async (logId: number) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      setLogDetail(null);
    } else {
      setExpandedLogId(logId);
      await loadLogDetail(logId);
    }
  };

  // Format datetime
  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  // Status badge component for log status
  const LogStatusBadge: React.FC<{ status: TaskLogStatus }> = ({ status }) => {
    const statusConfig: Record<TaskLogStatus, { bg: string; text: string; label: string }> = {
      running: { bg: 'bg-blue-100', text: 'text-blue-600', label: '运行中' },
      success: { bg: 'bg-green-100', text: 'text-green-600', label: '成功' },
      failed: { bg: 'bg-red-100', text: 'text-red-600', label: '失败' },
      skipped: { bg: 'bg-gray-100', text: 'text-gray-600', label: '跳过' },
    };
    const config = statusConfig[status] || statusConfig.failed;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Status badge component for agent result status
  const AgentStatusBadge: React.FC<{ status: AgentResultStatus }> = ({ status }) => {
    const statusConfig: Record<AgentResultStatus, { bg: string; text: string; label: string }> = {
      success: { bg: 'bg-green-100', text: 'text-green-600', label: '成功' },
      failed: { bg: 'bg-red-100', text: 'text-red-600', label: '失败' },
      skipped: { bg: 'bg-gray-100', text: 'text-gray-600', label: '跳过' },
    };
    const config = statusConfig[status] || statusConfig.failed;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Agent results table
  const AgentResultsTable: React.FC<{ results: AgentResult[] }> = ({ results }) => (
    <div className="bg-gray-50 rounded-lg p-4 mt-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
        Agent执行详情
      </h4>
      {results.length === 0 ? (
        <p className="text-sm text-gray-400">无Agent执行记录</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                Agent名称
              </th>
              <th className="py-2 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                状态
              </th>
              <th className="py-2 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                耗时
              </th>
              <th className="py-2 px-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                错误信息
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((result, index) => (
              <tr key={`${result.agent_id}-${index}`} className="hover:bg-gray-100/50">
                <td className="py-2 px-3 text-gray-700">{result.agent_name}</td>
                <td className="py-2 px-3">
                  <AgentStatusBadge status={result.status} />
                </td>
                <td className="py-2 px-3 text-gray-600">{formatDuration(result.duration_ms)}</td>
                <td className="py-2 px-3">
                  {result.error_message ? (
                    <span className="text-red-500 text-xs">{result.error_message}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              运行日志 - {taskName}
            </h2>
            <p className="text-sm text-gray-500">
              {loading ? '加载中...' : `共 ${total} 条记录`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无运行日志</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={log.log_id}>
                  {/* Log row */}
                  <div
                    onClick={() => handleRowClick(log.log_id)}
                    className={`
                      cursor-pointer rounded-lg border transition-all
                      ${expandedLogId === log.log_id 
                        ? 'border-space-black/20 bg-gray-50' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'}
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                    `}
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-4">
                        {/* Expand icon */}
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedLogId === log.log_id ? 'rotate-90' : ''}`}
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        
                        {/* Run time */}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700">
                            {formatDateTime(log.started_at)}
                          </span>
                          {log.completed_at && (
                            <span className="text-xs text-gray-400">
                              完成于 {formatDateTime(log.completed_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Duration */}
                        <span className="text-sm text-gray-600">
                          {formatDuration(log.duration_ms)}
                        </span>

                        {/* Agent stats */}
                        <div className="text-xs">
                          <span className="text-green-600">成功{log.agent_success_count}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-red-500">失败{log.agent_fail_count}</span>
                        </div>

                        {/* Status */}
                        <LogStatusBadge status={log.status} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedLogId === log.log_id && (
                    <div className="ml-8 mr-2 mb-2">
                      {loadingDetail ? (
                        <div className="bg-gray-50 rounded-lg p-4 mt-2 text-center text-gray-500">
                          加载详情中...
                        </div>
                      ) : logDetail ? (
                        <>
                          {/* Skip reason or error message */}
                          {logDetail.skip_reason && (
                            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mt-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">跳过原因</span>
                              <p className="text-sm text-yellow-700 mt-1">{logDetail.skip_reason}</p>
                            </div>
                          )}
                          {logDetail.error_message && (
                            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mt-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-red-600">错误信息</span>
                              <p className="text-sm text-red-700 mt-1">{logDetail.error_message}</p>
                            </div>
                          )}
                          {/* Agent results */}
                          <AgentResultsTable results={logDetail.agent_results} />
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <button
                onClick={() => loadLogs(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskLogModal;
