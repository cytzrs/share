import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui';
import { systemApi, agentApi, taskApi } from '../services/api';
import { useToast, useAuth } from '../contexts';
import { TaskList, TaskForm, TaskLogModal } from '../components/task';
import type { SystemTask, ModelAgent, TaskCreate } from '../types';

interface SystemConfig {
  data_source: string;
  tushare_token: string;
  commission_rate: string;
  stamp_tax_rate: string;
  transfer_fee_rate: string;
}

const DATA_SOURCE_OPTIONS = [
  { value: 'tushare', label: 'Tushare' },
  { value: 'akshare', label: 'AKShare' },
  { value: 'mock', label: '模拟数据' },
];

// 紧凑的输入框样式
const inputClass = "border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:ring-1 focus:ring-space-black/20 focus:border-gray-400 outline-none bg-white";
const selectClass = `${inputClass} pr-8`;
const labelClass = "text-xs font-medium text-gray-600";

const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    data_source: 'tushare',
    tushare_token: '',
    commission_rate: '0.0003',
    stamp_tax_rate: '0.001',
    transfer_fee_rate: '0.00002',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  // Task management state
  const [tasks, setTasks] = useState<SystemTask[]>([]);
  const [agents, setAgents] = useState<ModelAgent[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskFormLoading, setTaskFormLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedTaskName, setSelectedTaskName] = useState<string>('');
  const [triggeringTaskId, setTriggeringTaskId] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await systemApi.getConfig();
        setConfig(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('加载配置失败:', err);
        toast.error('加载配置失败');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Load tasks and agents
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const response = await taskApi.list();
      setTasks(response.tasks);
    } catch (err) {
      console.error('加载任务列表失败:', err);
      toast.error('加载任务列表失败');
    } finally {
      setTasksLoading(false);
    }
  }, [toast]);

  const loadAgents = useCallback(async () => {
    try {
      const response = await agentApi.list({ page_size: 100 });
      setAgents(response.items);
    } catch (err) {
      console.error('加载Agent列表失败:', err);
    }
  }, []);

  // Load tasks and agents on mount
  useEffect(() => {
    loadTasks();
    loadAgents();
  }, [loadTasks, loadAgents]);

  // Task management handlers
  const handleCreateTask = async (taskData: TaskCreate) => {
    setTaskFormLoading(true);
    try {
      if (editingTaskId) {
        // Update existing task
        await taskApi.update(editingTaskId, taskData);
        toast.success('任务更新成功');
      } else {
        // Create new task
        await taskApi.create(taskData);
        toast.success('任务创建成功');
      }
      setShowTaskForm(false);
      setEditingTaskId(null);
      loadTasks();
    } catch (err) {
      console.error('任务操作失败:', err);
      toast.error(editingTaskId ? '更新任务失败' : '创建任务失败');
      throw err;
    } finally {
      setTaskFormLoading(false);
    }
  };

  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setShowTaskForm(true);
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      await taskApi.pause(taskId);
      toast.success('任务已暂停');
      loadTasks();
    } catch (err) {
      console.error('暂停任务失败:', err);
      toast.error('暂停任务失败');
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await taskApi.resume(taskId);
      toast.success('任务已恢复');
      loadTasks();
    } catch (err) {
      console.error('恢复任务失败:', err);
      toast.error('恢复任务失败');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('确定要删除此任务吗？历史运行日志将被保留。')) {
      return;
    }
    try {
      await taskApi.delete(taskId);
      toast.success('任务已删除');
      loadTasks();
    } catch (err) {
      console.error('删除任务失败:', err);
      toast.error('删除任务失败');
    }
  };

  const handleTriggerTask = async (taskId: string) => {
    setTriggeringTaskId(taskId);
    try {
      const result = await taskApi.trigger(taskId);
      if (result.success) {
        toast.success(result.status === 'skipped' ? '任务已跳过（非交易日）' : '任务执行成功');
      } else {
        toast.error(result.message || '任务执行失败');
      }
      loadTasks();
    } catch (err) {
      console.error('触发任务失败:', err);
      toast.error('触发任务失败');
    } finally {
      setTriggeringTaskId(null);
    }
  };

  const handleViewLogs = (taskId: string) => {
    const task = tasks.find(t => t.task_id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskName(task?.name || '');
    setLogModalOpen(true);
  };

  const handleCloseLogModal = () => {
    setLogModalOpen(false);
    setSelectedTaskId('');
    setSelectedTaskName('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await systemApi.updateConfig(config);
      setConfig(prev => ({ ...prev, ...updated }));
      toast.success('配置已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof SystemConfig, value: string | boolean | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="h-full bg-ios-gray p-4 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 overflow-auto">
      <div className="space-y-4">
        {/* 系统配置卡片 - 紧凑布局 */}
        <GlassCard className="p-3">
          <div className="space-y-2">
            {/* 数据源配置 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>数据源</label>
                <select value={config.data_source} onChange={e => handleChange('data_source', e.target.value)} className={`${selectClass} w-full mt-0.5`}>
                  {DATA_SOURCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              {config.data_source === 'tushare' && (
                <div className="col-span-2">
                  <label className={labelClass}>Tushare Token</label>
                  <input type="password" value={config.tushare_token} onChange={e => handleChange('tushare_token', e.target.value)} placeholder="API Token" className={`${inputClass} w-full mt-0.5`} />
                </div>
              )}
            </div>

            {/* 交易费率配置 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>佣金</label>
                <input type="text" value={config.commission_rate} onChange={e => handleChange('commission_rate', e.target.value)} className={`${inputClass} w-full mt-0.5`} />
                <p className="text-xs text-gray-400 mt-0.5">万分之三</p>
              </div>
              <div>
                <label className={labelClass}>印花税</label>
                <input type="text" value={config.stamp_tax_rate} onChange={e => handleChange('stamp_tax_rate', e.target.value)} className={`${inputClass} w-full mt-0.5`} />
                <p className="text-xs text-gray-400 mt-0.5">千分之一</p>
              </div>
              <div>
                <label className={labelClass}>过户费</label>
                <input type="text" value={config.transfer_fee_rate} onChange={e => handleChange('transfer_fee_rate', e.target.value)} className={`${inputClass} w-full mt-0.5`} />
                <p className="text-xs text-gray-400 mt-0.5">万分之0.2</p>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end pt-1">
              <button 
                onClick={handleSave} 
                disabled={saving || !isAuthenticated} 
                className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isAuthenticated ? '需要登录才能执行此操作' : ''}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* 系统任务区块 */}
        <TaskList
          tasks={tasks}
          agents={agents}
          onPause={handlePauseTask}
          onResume={handleResumeTask}
          onDelete={handleDeleteTask}
          onViewLogs={handleViewLogs}
          onTrigger={handleTriggerTask}
          onEditTask={handleEditTask}
          onAddTask={() => setShowTaskForm(true)}
          loading={tasksLoading}
          isAuthenticated={isAuthenticated}
          triggeringTaskId={triggeringTaskId}
        />

        {/* 新增/编辑任务表单弹窗 */}
        {showTaskForm && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTaskForm(false);
                setEditingTaskId(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowTaskForm(false);
                setEditingTaskId(null);
              }
            }}
            tabIndex={-1}
            ref={(el) => el?.focus()}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTaskId ? '编辑任务' : '新增任务'}
                </h2>
                <button 
                  onClick={() => {
                    setShowTaskForm(false);
                    setEditingTaskId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <TaskForm
                  agents={agents}
                  task={editingTaskId ? tasks.find(t => t.task_id === editingTaskId) : undefined}
                  onSubmit={handleCreateTask}
                  onCancel={() => {
                    setShowTaskForm(false);
                    setEditingTaskId(null);
                  }}
                  loading={taskFormLoading}
                />
              </div>
            </div>
          </div>
        )}

        {/* 日志详情弹窗 */}
        <TaskLogModal
          taskId={selectedTaskId}
          taskName={selectedTaskName}
          isOpen={logModalOpen}
          onClose={handleCloseLogModal}
        />
      </div>
    </div>
  );
};

export default SystemSettings;
