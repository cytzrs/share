import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui';
import { TemplateList, TemplateEditor, TemplatePreview } from '../components/prompt';
import { templateApi } from '../services/api';
import { useAuth } from '../contexts';
import { ListSkeleton, DetailPanelSkeleton } from '../components/common';
import type { 
  PromptTemplate, 
  CreateTemplateRequest, 
  UpdateTemplateRequest 
} from '../types';

/**
 * 提示词模板管理页面
 * 支持模板列表展示、创建/编辑、预览功能
 */
const Templates: React.FC = () => {
  // State
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  
  const { isAuthenticated } = useAuth();

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await templateApi.list({ page: 1, page_size: 100 });
      setTemplates(response.items);

      // If we had a selected template, refresh its data
      if (selectedTemplate) {
        const updated = response.items.find(t => t.template_id === selectedTemplate.template_id);
        if (updated) {
          setSelectedTemplate(updated);
        } else if (response.items.length > 0) {
          // Selected template was deleted, select first one
          setSelectedTemplate(response.items[0]);
        } else {
          setSelectedTemplate(null);
        }
      } else if (response.items.length > 0) {
        // No template selected, auto-select first one
        setSelectedTemplate(response.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: PromptTemplate) => {
    setSelectedTemplate(template);
  }, []);

  // Handle create click
  const handleCreateClick = useCallback(() => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  }, []);

  // Handle edit click
  const handleEditClick = useCallback(() => {
    if (selectedTemplate) {
      setEditingTemplate(selectedTemplate);
      setIsEditorOpen(true);
    }
  }, [selectedTemplate]);

  // Handle save
  const handleSave = useCallback(async (data: CreateTemplateRequest | UpdateTemplateRequest) => {
    if (editingTemplate) {
      // Update existing template
      const updated = await templateApi.update(editingTemplate.template_id, data as UpdateTemplateRequest);
      setTemplates(prev => prev.map(t => t.template_id === updated.template_id ? updated : t));
      setSelectedTemplate(updated);
    } else {
      // Create new template
      const created = await templateApi.create(data as CreateTemplateRequest);
      setTemplates(prev => [...prev, created]);
      setSelectedTemplate(created);
    }
  }, [editingTemplate]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!editingTemplate) return;
    
    await templateApi.delete(editingTemplate.template_id);
    setTemplates(prev => prev.filter(t => t.template_id !== editingTemplate.template_id));
    if (selectedTemplate?.template_id === editingTemplate.template_id) {
      setSelectedTemplate(null);
    }
  }, [editingTemplate, selectedTemplate]);

  // Handle close editor
  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
  }, []);

  // Error state
  if (error && !loading) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center p-4">
        <GlassCard className="max-w-md p-6 rounded-[7px]">
          <div className="text-center">
            <div className="text-loss-red mb-4 text-lg font-semibold">加载失败</div>
            <p className="text-gray-500 mb-4">{error}</p>
            <button 
              onClick={loadTemplates}
              className="text-info-blue hover:underline font-medium"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="h-full flex flex-col">
        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
          {/* Template List - Left Column (2/5) */}
          <div className="lg:col-span-2 h-full flex flex-col">
            <TemplateList
              templates={templates}
              selectedTemplateId={selectedTemplate?.template_id}
              onTemplateSelect={handleTemplateSelect}
              onCreateClick={handleCreateClick}
              loading={loading}
              disabled={!isAuthenticated}
            />
          </div>

          {/* Template Preview - Right Column (3/5) */}
          <div className="lg:col-span-3 h-full flex flex-col">
            {selectedTemplate ? (
              <TemplatePreview 
                template={selectedTemplate} 
                onEdit={handleEditClick}
                disabled={!isAuthenticated}
              />
            ) : (
              <GlassCard className="p-6 rounded-[7px] h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-2">选择一个模板查看详情</p>
                  <p className="text-xs text-gray-400">或点击左侧"创建模板"按钮创建新的模板</p>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <TemplateEditor
        isOpen={isEditorOpen}
        template={editingTemplate}
        onSave={handleSave}
        onDelete={editingTemplate ? handleDelete : undefined}
        onClose={handleCloseEditor}
        loading={loading}
        disabled={!isAuthenticated}
      />
    </div>
  );
};

export default Templates;
