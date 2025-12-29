import React from 'react';
import { GlassCard, Label } from '../ui';
import { TemplateCard } from './TemplateCard';
import type { PromptTemplate } from '../../types';

interface TemplateListProps {
  templates: PromptTemplate[];
  selectedTemplateId?: string;
  onTemplateSelect: (template: PromptTemplate) => void;
  onCreateClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * 模板列表组件
 * 展示所有提示词模板，支持选择和创建
 */
export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onCreateClick,
  loading = false,
  disabled = false,
}) => {
  return (
    <GlassCard className="p-4 rounded-[10px] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-info-blue to-purple-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <Label className="text-sm text-left block">提示词模板</Label>
            <p className="text-xs text-gray-400">{templates.length} 个模板</p>
          </div>
        </div>
        <button
          onClick={onCreateClick}
          disabled={disabled}
          className="px-4 py-1.5 text-sm font-medium text-white bg-space-black hover:bg-graphite rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={disabled ? '需要登录才能执行此操作' : ''}
        >
          新建
        </button>
      </div>

      {/* Template List */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
        {loading ? (
          // Loading skeleton
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : templates.length === 0 ? (
          // Empty state
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-7 h-7 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm mb-1">暂无模板</p>
            <p className="text-xs text-gray-400">点击上方按钮创建</p>
          </div>
        ) : (
          // Template cards
          templates.map((template) => (
            <TemplateCard
              key={template.template_id}
              template={template}
              isSelected={template.template_id === selectedTemplateId}
              onClick={() => onTemplateSelect(template)}
            />
          ))
        )}
      </div>
    </GlassCard>
  );
};

export default TemplateList;
