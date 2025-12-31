import React, { useState, useEffect, useMemo } from 'react';
import type { MCPTool, MCPToolTestResponse } from '../../types';
import { mcpApi } from '../../services/api';

interface ToolTestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: number;
  tool: MCPTool | null;
}

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * 工具测试面板组件
 * 基于 inputSchema 动态生成表单，执行工具测试并展示结果
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export const ToolTestPanel: React.FC<ToolTestPanelProps> = ({
  isOpen,
  onClose,
  serverId,
  tool,
}) => {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<MCPToolTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse input schema
  const schema = useMemo<JsonSchema | null>(() => {
    if (!tool?.input_schema) return null;
    try {
      return tool.input_schema as JsonSchema;
    } catch {
      return null;
    }
  }, [tool]);

  // Get properties from schema
  const properties = useMemo(() => {
    if (!schema?.properties) return [];
    return Object.entries(schema.properties).map(([name, prop]) => ({
      name,
      ...prop,
      isRequired: schema.required?.includes(name) || false,
    }));
  }, [schema]);

  // Reset form when tool changes
  useEffect(() => {
    if (tool) {
      const initialValues: Record<string, unknown> = {};
      properties.forEach(prop => {
        if (prop.default !== undefined) {
          initialValues[prop.name] = prop.default;
        } else if (prop.type === 'boolean') {
          initialValues[prop.name] = false;
        } else if (prop.type === 'number' || prop.type === 'integer') {
          initialValues[prop.name] = '';
        } else if (prop.type === 'array') {
          initialValues[prop.name] = [];
        } else if (prop.type === 'object') {
          initialValues[prop.name] = {};
        } else {
          initialValues[prop.name] = '';
        }
      });
      setFormValues(initialValues);
      setResult(null);
      setError(null);
    }
  }, [tool, properties]);

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

  const handleValueChange = (name: string, value: unknown) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;

    setTesting(true);
    setResult(null);
    setError(null);

    try {
      // Build arguments object, converting types as needed
      const args: Record<string, unknown> = {};
      properties.forEach(prop => {
        const value = formValues[prop.name];
        if (value !== '' && value !== undefined) {
          if (prop.type === 'number' || prop.type === 'integer') {
            args[prop.name] = Number(value);
          } else if (prop.type === 'boolean') {
            args[prop.name] = Boolean(value);
          } else if (prop.type === 'array' && typeof value === 'string') {
            try {
              args[prop.name] = JSON.parse(value);
            } catch {
              args[prop.name] = value.split(',').map(s => s.trim()).filter(Boolean);
            }
          } else if (prop.type === 'object' && typeof value === 'string') {
            try {
              args[prop.name] = JSON.parse(value);
            } catch {
              args[prop.name] = value;
            }
          } else {
            args[prop.name] = value;
          }
        }
      });

      const response = await mcpApi.testTool(serverId, tool.name, { arguments: args });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试执行失败');
    } finally {
      setTesting(false);
    }
  };

  // Render form field based on property type
  const renderField = (prop: JsonSchemaProperty & { name: string; isRequired: boolean }) => {
    const value = formValues[prop.name];

    // Enum type - render as select
    if (prop.enum && prop.enum.length > 0) {
      return (
        <select
          value={String(value || '')}
          onChange={(e) => handleValueChange(prop.name, e.target.value)}
          disabled={testing}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none bg-white w-full"
        >
          <option value="">选择...</option>
          {prop.enum.map((opt, i) => (
            <option key={i} value={String(opt)}>{String(opt)}</option>
          ))}
        </select>
      );
    }

    // Boolean type - render as checkbox
    if (prop.type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => handleValueChange(prop.name, e.target.checked)}
            disabled={testing}
            className="w-4 h-4 rounded border-gray-300 text-space-black focus:ring-space-black/20"
          />
          <span className="text-sm text-gray-600">{prop.description || prop.name}</span>
        </div>
      );
    }

    // Number/Integer type
    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <input
          type="number"
          value={String(value || '')}
          onChange={(e) => handleValueChange(prop.name, e.target.value)}
          disabled={testing}
          step={prop.type === 'integer' ? 1 : 'any'}
          placeholder={prop.description || `输入${prop.name}`}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none w-full"
        />
      );
    }

    // Array type - render as textarea
    if (prop.type === 'array') {
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value || [], null, 2)}
          onChange={(e) => handleValueChange(prop.name, e.target.value)}
          disabled={testing}
          placeholder={prop.description || 'JSON数组或逗号分隔的值'}
          rows={3}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none w-full resize-none font-mono text-sm"
        />
      );
    }

    // Object type - render as textarea for JSON
    if (prop.type === 'object') {
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)}
          onChange={(e) => handleValueChange(prop.name, e.target.value)}
          disabled={testing}
          placeholder={prop.description || 'JSON对象'}
          rows={4}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none w-full resize-none font-mono text-sm"
        />
      );
    }

    // Default: string type - render as input or textarea based on description
    const isLongText = prop.description?.toLowerCase().includes('content') || 
                       prop.description?.toLowerCase().includes('body') ||
                       prop.description?.toLowerCase().includes('text');
    
    if (isLongText) {
      return (
        <textarea
          value={String(value || '')}
          onChange={(e) => handleValueChange(prop.name, e.target.value)}
          disabled={testing}
          placeholder={prop.description || `输入${prop.name}`}
          rows={3}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none w-full resize-none"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(value || '')}
        onChange={(e) => handleValueChange(prop.name, e.target.value)}
        disabled={testing}
        placeholder={prop.description || `输入${prop.name}`}
        className="border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-space-black/20 focus:border-gray-400 outline-none w-full"
      />
    );
  };

  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-[7px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">测试工具</h2>
            <p className="text-sm text-gray-500 mt-1">
              {tool.name}
              {tool.translation && <span className="ml-2">({tool.translation})</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tool Description */}
          {tool.description && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{tool.description}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {properties.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>此工具无需输入参数</p>
              </div>
            ) : (
              properties.map(prop => (
                <div key={prop.name} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {prop.name}
                    {prop.isRequired && <span className="text-loss-red ml-1">*</span>}
                  </label>
                  {prop.description && prop.type !== 'boolean' && (
                    <p className="text-xs text-gray-400 mb-1">{prop.description}</p>
                  )}
                  {renderField(prop)}
                </div>
              ))
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={testing}
                className="w-full px-5 py-2.5 bg-space-black text-white rounded-[7px] font-medium hover:bg-graphite transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    执行中...
                  </span>
                ) : '执行测试'}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-loss-red/10 border border-loss-red/20 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-loss-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-loss-red">执行失败</h4>
                  <p className="text-sm text-loss-red/80 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg border ${
              result.success 
                ? 'bg-profit-green/10 border-profit-green/20' 
                : 'bg-loss-red/10 border-loss-red/20'
            }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <svg className="w-5 h-5 text-profit-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-loss-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold ${result.success ? 'text-profit-green' : 'text-loss-red'}`}>
                      {result.success ? '执行成功' : '执行失败'}
                    </h4>
                    {result.duration_ms !== undefined && (
                      <span className="text-xs text-gray-400">{result.duration_ms}ms</span>
                    )}
                  </div>
                  
                  {result.error_message && (
                    <p className="text-sm text-loss-red/80 mt-2">{result.error_message}</p>
                  )}
                  
                  {result.result !== undefined && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">返回结果</div>
                      <pre className="bg-white/50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto max-h-60 overflow-y-auto">
                        {typeof result.result === 'string' 
                          ? result.result 
                          : JSON.stringify(result.result, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolTestPanel;
