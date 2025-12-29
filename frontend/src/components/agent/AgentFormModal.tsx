import React, { useState, useEffect } from 'react';
import type { ModelAgent, CreateAgentRequest, UpdateAgentRequest, PromptTemplate, LLMProvider, LLMModel } from '../../types';
import { llmProviderApi } from '../../services/api';

interface AgentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAgentRequest | UpdateAgentRequest) => Promise<void>;
  agent?: ModelAgent | null; // If provided, we're editing
  templates: PromptTemplate[];
  loading?: boolean;
}

interface FormData {
  name: string;
  initial_cash: string;
  template_id: string;
  provider_id: string;
  llm_model: string;
  schedule_type: string;
}

interface FormErrors {
  name?: string;
  initial_cash?: string;
  template_id?: string;
  provider_id?: string;
  llm_model?: string;
}

const SCHEDULE_TYPES = [
  { value: 'daily', label: '每日一次' },
  { value: 'hourly', label: '每小时一次' },
  { value: 'manual', label: '手动触发' },
];

/**
 * Agent创建/编辑模态框组件
 * 支持表单验证和提交处理
 */
export const AgentFormModal: React.FC<AgentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  agent,
  templates,
  loading = false,
}) => {
  const isEditing = !!agent;
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    initial_cash: '20000',
    template_id: '',
    provider_id: '',
    llm_model: '',
    schedule_type: 'daily',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load providers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen]);

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

  // Load models when provider changes
  useEffect(() => {
    if (formData.provider_id) {
      loadModels(formData.provider_id);
    } else {
      setModels([]);
    }
  }, [formData.provider_id]);

  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const data = await llmProviderApi.list();
      setProviders(data.filter(p => p.is_active));
    } catch (err) {
      console.error('Failed to load providers:', err);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadModels = async (providerId: string) => {
    setLoadingModels(true);
    setModels([]);
    try {
      const data = await llmProviderApi.getModels(providerId);
      setModels(data);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  // Reset form when modal opens or agent changes
  useEffect(() => {
    if (isOpen) {
      if (agent) {
        setFormData({
          name: agent.name,
          initial_cash: agent.initial_cash.toString(),
          template_id: agent.template_id,
          provider_id: agent.provider_id || '',
          llm_model: agent.llm_model,
          schedule_type: agent.schedule_type,
        });
      } else {
        setFormData({
          name: '',
          initial_cash: '20000',
          template_id: templates[0]?.template_id || '',
          provider_id: '',
          llm_model: '',
          schedule_type: 'daily',
        });
      }
      setErrors({});
    }
  }, [isOpen, agent, templates]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入Agent名称';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Agent名称不能超过100个字符';
    }

    if (!isEditing) {
      const cash = parseFloat(formData.initial_cash);
      if (isNaN(cash) || cash <= 0) {
        newErrors.initial_cash = '请输入有效的初始资金';
      } else if (cash < 1000) {
        newErrors.initial_cash = '初始资金不能少于1000元';
      } else if (cash > 10000000) {
        newErrors.initial_cash = '初始资金不能超过1000万元';
      }
    }

    if (!formData.template_id) {
      newErrors.template_id = '请选择提示词模板';
    }

    if (!formData.provider_id) {
      newErrors.provider_id = '请选择LLM渠道';
    }

    if (!formData.llm_model) {
      newErrors.llm_model = '请选择LLM模型';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        const updateData: UpdateAgentRequest = {
          name: formData.name,
          template_id: formData.template_id,
          provider_id: formData.provider_id,
          llm_model: formData.llm_model,
          schedule_type: formData.schedule_type,
        };
        await onSubmit(updateData);
      } else {
        const createData: CreateAgentRequest = {
          name: formData.name,
          initial_cash: parseFloat(formData.initial_cash),
          template_id: formData.template_id,
          provider_id: formData.provider_id,
          llm_model: formData.llm_model,
          schedule_type: formData.schedule_type,
        };
        await onSubmit(createData);
      }
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Clear model when provider changes
      if (field === 'provider_id') {
        newData.llm_model = '';
      }
      return newData;
    });
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-[7px] shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? '编辑Agent' : '创建Agent'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Agent名称</label>
            <input
              placeholder="输入Agent名称"
              value={formData.name}
              onChange={handleChange('name')}
              disabled={loading || submitting}
              className={`border rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 outline-none ${errors.name ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
            />
            {errors.name && <span className="text-loss-red text-xs">{errors.name}</span>}
          </div>

          {/* Initial Cash - Only for create */}
          {!isEditing && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">初始资金 (元)</label>
              <input
                type="number"
                placeholder="20000"
                value={formData.initial_cash}
                onChange={handleChange('initial_cash')}
                disabled={loading || submitting}
                min="1000"
                max="10000000"
                step="100"
                className={`border rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 outline-none ${errors.initial_cash ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
              />
              {errors.initial_cash && <span className="text-loss-red text-xs">{errors.initial_cash}</span>}
            </div>
          )}

          {/* Template Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">提示词模板</label>
            <select
              value={formData.template_id}
              onChange={handleChange('template_id')}
              disabled={loading || submitting}
              className={`border rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-space-black/20 outline-none bg-white ${errors.template_id ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
            >
              <option value="">选择模板...</option>
              {templates.map(template => (
                <option key={template.template_id} value={template.template_id}>
                  {template.name} (v{template.version})
                </option>
              ))}
            </select>
            {errors.template_id && <span className="text-loss-red text-xs">{errors.template_id}</span>}
            {templates.length === 0 && (
              <span className="text-warning-orange text-xs">暂无可用模板，请先创建提示词模板</span>
            )}
          </div>

          {/* LLM Provider Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">LLM渠道</label>
            <select
              value={formData.provider_id}
              onChange={handleChange('provider_id')}
              disabled={loading || submitting || loadingProviders}
              className={`border rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-space-black/20 outline-none bg-white ${errors.provider_id ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
            >
              <option value="">{loadingProviders ? '加载中...' : '选择渠道...'}</option>
              {providers.map(provider => (
                <option key={provider.provider_id} value={provider.provider_id}>
                  {provider.name} ({provider.protocol})
                </option>
              ))}
            </select>
            {errors.provider_id && <span className="text-loss-red text-xs">{errors.provider_id}</span>}
            {!loadingProviders && providers.length === 0 && (
              <span className="text-warning-orange text-xs">暂无可用渠道，请先在设置中添加LLM渠道</span>
            )}
          </div>

          {/* LLM Model Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">LLM模型</label>
            <select
              value={formData.llm_model}
              onChange={handleChange('llm_model')}
              disabled={loading || submitting || !formData.provider_id || loadingModels}
              className={`border rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-space-black/20 outline-none bg-white ${errors.llm_model ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
            >
              <option value="">
                {!formData.provider_id 
                  ? '请先选择渠道' 
                  : loadingModels 
                    ? '加载模型中...' 
                    : '选择模型...'}
              </option>
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
            {errors.llm_model && <span className="text-loss-red text-xs">{errors.llm_model}</span>}
          </div>

          {/* Schedule Type Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">决策周期</label>
            <select
              value={formData.schedule_type}
              onChange={handleChange('schedule_type')}
              disabled={loading || submitting}
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none bg-white"
            >
              {SCHEDULE_TYPES.map(schedule => (
                <option key={schedule.value} value={schedule.value}>
                  {schedule.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 border border-gray-300 rounded-[7px] text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || submitting || templates.length === 0}
              className="px-5 py-2.5 bg-space-black text-white rounded-[7px] font-medium hover:bg-graphite transition-colors disabled:opacity-50"
            >
              {submitting ? '提交中...' : isEditing ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentFormModal;
