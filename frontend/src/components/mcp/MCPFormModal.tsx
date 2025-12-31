import React, { useState, useEffect } from 'react';
import type { MCPServer, MCPServerCreate, MCPServerUpdate, MCPConnectionCreate, MCPToolCreate } from '../../types';

interface MCPFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MCPServerCreate | MCPServerUpdate) => Promise<void>;
  server?: MCPServer | null; // If provided, we're editing
  loading?: boolean;
}

interface FormData {
  qualified_name: string;
  display_name: string;
  description: string;
  logo: string;
  creator: string;
  type: number;
  tag: string;
  introduction: string;
  is_domestic: boolean;
  package_url: string;
  repository_id: string;
  connections: MCPConnectionCreate[];
  tools: MCPToolCreate[];
}

interface FormErrors {
  qualified_name?: string;
  display_name?: string;
  description?: string;
}

const DEFAULT_CONNECTION: MCPConnectionCreate = {
  connection_type: 'stdio',
  command: '',
  args: [],
  env: {},
};

const DEFAULT_TOOL: MCPToolCreate = {
  name: '',
  description: '',
  input_schema: {},
  translation: '',
};

/**
 * MCP服务创建/编辑模态框组件
 * 支持创建和编辑MCP服务
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */
export const MCPFormModal: React.FC<MCPFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  server,
  loading = false,
}) => {
  const isEditing = !!server;
  
  const [formData, setFormData] = useState<FormData>({
    qualified_name: '',
    display_name: '',
    description: '',
    logo: '',
    creator: '',
    type: 1,
    tag: '',
    introduction: '',
    is_domestic: true,
    package_url: '',
    repository_id: '',
    connections: [{ ...DEFAULT_CONNECTION }],
    tools: [],
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'connections' | 'tools'>('basic');

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

  // Reset form when modal opens or server changes
  useEffect(() => {
    if (isOpen) {
      if (server) {
        setFormData({
          qualified_name: server.qualified_name,
          display_name: server.display_name,
          description: server.description || '',
          logo: server.logo || '',
          creator: server.creator || '',
          type: server.type,
          tag: server.tag || '',
          introduction: server.introduction || '',
          is_domestic: server.is_domestic,
          package_url: server.package_url || '',
          repository_id: server.repository_id || '',
          connections: server.connections.length > 0 
            ? server.connections.map(c => ({
                connection_type: c.connection_type,
                command: c.command || '',
                args: c.args || [],
                env: c.env || {},
              }))
            : [{ ...DEFAULT_CONNECTION }],
          tools: server.tools.map(t => ({
            name: t.name,
            description: t.description || '',
            input_schema: t.input_schema || {},
            translation: t.translation || '',
          })),
        });
      } else {
        setFormData({
          qualified_name: '',
          display_name: '',
          description: '',
          logo: '',
          creator: '',
          type: 1,
          tag: '',
          introduction: '',
          is_domestic: true,
          package_url: '',
          repository_id: '',
          connections: [{ ...DEFAULT_CONNECTION }],
          tools: [],
        });
      }
      setErrors({});
      setActiveSection('basic');
    }
  }, [isOpen, server]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isEditing && !formData.qualified_name.trim()) {
      newErrors.qualified_name = '请输入唯一标识名';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = '请输入显示名称';
    } else if (formData.display_name.length > 100) {
      newErrors.display_name = '显示名称不能超过100个字符';
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
        const updateData: MCPServerUpdate = {
          display_name: formData.display_name,
          description: formData.description || undefined,
          logo: formData.logo || undefined,
          creator: formData.creator || undefined,
          type: formData.type,
          tag: formData.tag || undefined,
          introduction: formData.introduction || undefined,
          is_domestic: formData.is_domestic,
          package_url: formData.package_url || undefined,
          repository_id: formData.repository_id || undefined,
          connections: formData.connections.filter(c => c.command),
          tools: formData.tools.filter(t => t.name),
        };
        await onSubmit(updateData);
      } else {
        const createData: MCPServerCreate = {
          qualified_name: formData.qualified_name,
          display_name: formData.display_name,
          description: formData.description || undefined,
          logo: formData.logo || undefined,
          creator: formData.creator || undefined,
          type: formData.type,
          tag: formData.tag || undefined,
          introduction: formData.introduction || undefined,
          is_domestic: formData.is_domestic,
          package_url: formData.package_url || undefined,
          repository_id: formData.repository_id || undefined,
          connections: formData.connections.filter(c => c.command),
          tools: formData.tools.filter(t => t.name),
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Connection handlers
  const addConnection = () => {
    setFormData(prev => ({
      ...prev,
      connections: [...prev.connections, { ...DEFAULT_CONNECTION }],
    }));
  };

  const removeConnection = (index: number) => {
    setFormData(prev => ({
      ...prev,
      connections: prev.connections.filter((_, i) => i !== index),
    }));
  };

  const updateConnection = (index: number, field: keyof MCPConnectionCreate, value: string | string[] | Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      connections: prev.connections.map((conn, i) => 
        i === index ? { ...conn, [field]: value } : conn
      ),
    }));
  };

  // Tool handlers
  const addTool = () => {
    setFormData(prev => ({
      ...prev,
      tools: [...prev.tools, { ...DEFAULT_TOOL }],
    }));
  };

  const removeTool = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.filter((_, i) => i !== index),
    }));
  };

  const updateTool = (index: number, field: keyof MCPToolCreate, value: string | Record<string, unknown>) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.map((tool, i) => 
        i === index ? { ...tool, [field]: value } : tool
      ),
    }));
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
      <div className="relative w-full max-w-2xl bg-white rounded-[7px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? '编辑MCP服务' : '创建MCP服务'}
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

        {/* Section Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {(['basic', 'connections', 'tools'] as const).map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section
                  ? 'border-space-black text-space-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {section === 'basic' && '基础信息'}
              {section === 'connections' && `连接配置 (${formData.connections.length})`}
              {section === 'tools' && `工具定义 (${formData.tools.length})`}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Basic Info Section */}
            {activeSection === 'basic' && (
              <>
                {/* Qualified Name - Only for create */}
                {!isEditing && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      唯一标识名 <span className="text-loss-red">*</span>
                    </label>
                    <input
                      placeholder="例如: @modelcontextprotocol/server-filesystem"
                      value={formData.qualified_name}
                      onChange={handleChange('qualified_name')}
                      disabled={loading || submitting}
                      className={`border rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 outline-none ${errors.qualified_name ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
                    />
                    {errors.qualified_name && <span className="text-loss-red text-xs">{errors.qualified_name}</span>}
                  </div>
                )}

                {/* Display Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    显示名称 <span className="text-loss-red">*</span>
                  </label>
                  <input
                    placeholder="例如: Filesystem Server"
                    value={formData.display_name}
                    onChange={handleChange('display_name')}
                    disabled={loading || submitting}
                    className={`border rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 outline-none ${errors.display_name ? 'border-loss-red' : 'border-gray-300 focus:border-gray-400'}`}
                  />
                  {errors.display_name && <span className="text-loss-red text-xs">{errors.display_name}</span>}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">描述</label>
                  <textarea
                    placeholder="简短描述MCP服务的功能"
                    value={formData.description}
                    onChange={handleChange('description')}
                    disabled={loading || submitting}
                    rows={2}
                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none"
                  />
                </div>

                {/* Two columns */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Logo URL */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Logo URL</label>
                    <input
                      placeholder="https://..."
                      value={formData.logo}
                      onChange={handleChange('logo')}
                      disabled={loading || submitting}
                      className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                    />
                  </div>

                  {/* Creator */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">创建者</label>
                    <input
                      placeholder="例如: Anthropic"
                      value={formData.creator}
                      onChange={handleChange('creator')}
                      disabled={loading || submitting}
                      className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">标签</label>
                  <input
                    placeholder="多个标签用逗号分隔，例如: 文件系统, 工具"
                    value={formData.tag}
                    onChange={handleChange('tag')}
                    disabled={loading || submitting}
                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                  />
                </div>

                {/* Introduction */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">详细介绍</label>
                  <textarea
                    placeholder="详细介绍MCP服务的功能和使用方法"
                    value={formData.introduction}
                    onChange={handleChange('introduction')}
                    disabled={loading || submitting}
                    rows={3}
                    className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none"
                  />
                </div>

                {/* Two columns */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Package URL */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">包地址</label>
                    <input
                      placeholder="npm/pypi包地址"
                      value={formData.package_url}
                      onChange={handleChange('package_url')}
                      disabled={loading || submitting}
                      className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                    />
                  </div>

                  {/* Repository ID */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">仓库ID</label>
                    <input
                      placeholder="GitHub仓库ID"
                      value={formData.repository_id}
                      onChange={handleChange('repository_id')}
                      disabled={loading || submitting}
                      className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                    />
                  </div>
                </div>

                {/* Is Domestic */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_domestic"
                    checked={formData.is_domestic}
                    onChange={handleChange('is_domestic')}
                    disabled={loading || submitting}
                    className="w-4 h-4 rounded border-gray-300 text-space-black focus:ring-space-black/20"
                  />
                  <label htmlFor="is_domestic" className="text-sm text-gray-700">国内服务</label>
                </div>
              </>
            )}

            {/* Connections Section */}
            {activeSection === 'connections' && (
              <div className="space-y-4">
                {formData.connections.map((conn, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700">连接 #{index + 1}</span>
                      {formData.connections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeConnection(index)}
                          className="text-loss-red text-xs hover:underline"
                        >
                          删除
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {/* Connection Type */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">连接类型</label>
                        <select
                          value={conn.connection_type}
                          onChange={(e) => updateConnection(index, 'connection_type', e.target.value)}
                          disabled={loading || submitting}
                          className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none bg-white"
                        >
                          <option value="stdio">stdio</option>
                          <option value="http">http</option>
                        </select>
                      </div>

                      {/* Command */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">命令</label>
                        <input
                          placeholder="例如: npx"
                          value={conn.command || ''}
                          onChange={(e) => updateConnection(index, 'command', e.target.value)}
                          disabled={loading || submitting}
                          className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                        />
                      </div>

                      {/* Args */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">参数（每行一个）</label>
                        <textarea
                          placeholder="-y&#10;@modelcontextprotocol/server-filesystem"
                          value={(conn.args || []).join('\n')}
                          onChange={(e) => updateConnection(index, 'args', e.target.value.split('\n').filter(Boolean))}
                          disabled={loading || submitting}
                          rows={3}
                          className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none font-mono text-sm"
                        />
                      </div>

                      {/* Env */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">环境变量（KEY=VALUE，每行一个）</label>
                        <textarea
                          placeholder="API_KEY=xxx&#10;DEBUG=true"
                          value={Object.entries(conn.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                          onChange={(e) => {
                            const env: Record<string, string> = {};
                            e.target.value.split('\n').forEach(line => {
                              const [key, ...valueParts] = line.split('=');
                              if (key && valueParts.length > 0) {
                                env[key.trim()] = valueParts.join('=').trim();
                              }
                            });
                            updateConnection(index, 'env', env);
                          }}
                          disabled={loading || submitting}
                          rows={2}
                          className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addConnection}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  + 添加连接配置
                </button>
              </div>
            )}

            {/* Tools Section */}
            {activeSection === 'tools' && (
              <div className="space-y-4">
                {formData.tools.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="mb-4">暂无工具定义</p>
                  </div>
                ) : (
                  formData.tools.map((tool, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">工具 #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeTool(index)}
                          className="text-loss-red text-xs hover:underline"
                        >
                          删除
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Tool Name */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">工具名称</label>
                          <input
                            placeholder="例如: read_file"
                            value={tool.name}
                            onChange={(e) => updateTool(index, 'name', e.target.value)}
                            disabled={loading || submitting}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                          />
                        </div>

                        {/* Translation */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">中文名称</label>
                          <input
                            placeholder="例如: 读取文件"
                            value={tool.translation || ''}
                            onChange={(e) => updateTool(index, 'translation', e.target.value)}
                            disabled={loading || submitting}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none"
                          />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">描述</label>
                          <textarea
                            placeholder="工具功能描述"
                            value={tool.description || ''}
                            onChange={(e) => updateTool(index, 'description', e.target.value)}
                            disabled={loading || submitting}
                            rows={2}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none"
                          />
                        </div>

                        {/* Input Schema */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">输入参数 Schema (JSON)</label>
                          <textarea
                            placeholder='{"type": "object", "properties": {...}}'
                            value={JSON.stringify(tool.input_schema || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const schema = JSON.parse(e.target.value);
                                updateTool(index, 'input_schema', schema);
                              } catch {
                                // Invalid JSON, keep the text but don't update
                              }
                            }}
                            disabled={loading || submitting}
                            rows={4}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none resize-none font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={addTool}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  + 添加工具定义
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-white flex-shrink-0">
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
              disabled={loading || submitting}
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

export default MCPFormModal;
