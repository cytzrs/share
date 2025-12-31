import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MCPFormModal } from './MCPFormModal';
import type { MCPServer, MCPServerCreate } from '../../types';

// Mock the @lobehub/icons module to avoid emoji-mart dependency issues
vi.mock('@lobehub/icons', () => ({
  OpenAI: () => null,
  Claude: () => null,
  Gemini: () => null,
  DeepSeek: () => null,
  Qwen: () => null,
  Cohere: () => null,
  Perplexity: () => null,
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Helper function to create a mock MCP server for editing
const createMockServer = (overrides: Partial<MCPServer> = {}): MCPServer => ({
  server_id: 1,
  qualified_name: 'test-server',
  display_name: 'Test Server',
  description: 'A test MCP server',
  logo: 'https://example.com/logo.png',
  creator: 'Test Creator',
  type: 1,
  tag: 'test,demo',
  introduction: 'Test introduction',
  is_domestic: true,
  package_url: 'https://example.com/package',
  repository_id: 'test-repo',
  use_count: 100,
  is_enabled: true,
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-06-20T14:45:00.000Z',
  connections: [
    {
      connection_id: 1,
      connection_type: 'stdio',
      command: 'npx',
      args: ['-y', 'test-server'],
      env: { NODE_ENV: 'production' },
    },
  ],
  tools: [
    {
      tool_id: 1,
      name: 'test_tool',
      description: 'A test tool',
      input_schema: { type: 'object', properties: {} },
      translation: '测试工具',
    },
  ],
  ...overrides,
});

describe('MCPFormModal', () => {
  /**
   * Requirements: 2.1
   * WHEN 管理员提交MCP服务创建表单 THEN THE MCP_Marketplace SHALL 验证必填字段（qualified_name、display_name、description）并创建新的MCP服务记录
   */
  describe('Form Validation (Requirement 2.1)', () => {
    it('should not render when isOpen is false', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={false}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      expect(screen.queryByText('创建MCP服务')).not.toBeInTheDocument();
    });

    it('should render create form when isOpen is true and no server provided', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      expect(screen.getByText('创建MCP服务')).toBeInTheDocument();
      expect(screen.getByText('创建')).toBeInTheDocument();
    });

    it('should show validation error when qualified_name is empty on create', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Try to submit without filling required fields
      const submitButton = screen.getByText('创建');
      await user.click(submitButton);
      
      expect(screen.getByText('请输入唯一标识名')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should show validation error when display_name is empty', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Fill qualified_name but not display_name
      const qualifiedNameInput = screen.getByPlaceholderText('例如: @modelcontextprotocol/server-filesystem');
      await user.type(qualifiedNameInput, 'test-server');
      
      const submitButton = screen.getByText('创建');
      await user.click(submitButton);
      
      expect(screen.getByText('请输入显示名称')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should show validation error when display_name exceeds 100 characters', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Fill qualified_name
      const qualifiedNameInput = screen.getByPlaceholderText('例如: @modelcontextprotocol/server-filesystem');
      await user.type(qualifiedNameInput, 'test-server');
      
      // Fill display_name with more than 100 characters
      const displayNameInput = screen.getByPlaceholderText('例如: Filesystem Server');
      const longName = 'a'.repeat(101);
      await user.type(displayNameInput, longName);
      
      const submitButton = screen.getByText('创建');
      await user.click(submitButton);
      
      expect(screen.getByText('显示名称不能超过100个字符')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onSubmit with correct data when form is valid', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Fill required fields
      const qualifiedNameInput = screen.getByPlaceholderText('例如: @modelcontextprotocol/server-filesystem');
      await user.type(qualifiedNameInput, 'my-test-server');
      
      const displayNameInput = screen.getByPlaceholderText('例如: Filesystem Server');
      await user.type(displayNameInput, 'My Test Server');
      
      const submitButton = screen.getByText('创建');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
      
      const submittedData = onSubmit.mock.calls[0][0] as MCPServerCreate;
      expect(submittedData.qualified_name).toBe('my-test-server');
      expect(submittedData.display_name).toBe('My Test Server');
    });
  });

  describe('Edit Mode', () => {
    it('should render edit form when server is provided', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      const server = createMockServer();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          server={server}
        />
      );
      
      expect(screen.getByText('编辑MCP服务')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
    });

    it('should not show qualified_name field in edit mode', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      const server = createMockServer();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          server={server}
        />
      );
      
      expect(screen.queryByPlaceholderText('例如: @modelcontextprotocol/server-filesystem')).not.toBeInTheDocument();
    });

    it('should populate form with server data in edit mode', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      const server = createMockServer({ display_name: 'Existing Server' });
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          server={server}
        />
      );
      
      const displayNameInput = screen.getByPlaceholderText('例如: Filesystem Server') as HTMLInputElement;
      expect(displayNameInput.value).toBe('Existing Server');
    });
  });

  describe('Modal Interactions', () => {
    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Click on backdrop (the black overlay)
      const backdrop = document.querySelector('.bg-black\\/40');
      await user.click(backdrop!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      const cancelButton = screen.getByText('取消');
      await user.click(cancelButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when ESC key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button (X) is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Find the close button (X icon)
      const closeButton = document.querySelector('button svg')?.closest('button');
      await user.click(closeButton!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Section Navigation', () => {
    it('should show basic info section by default', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Basic info fields should be visible
      expect(screen.getByPlaceholderText('例如: Filesystem Server')).toBeInTheDocument();
    });

    it('should switch to connections section when tab is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      const connectionsTab = screen.getByText(/连接配置/);
      await user.click(connectionsTab);
      
      // Connection fields should be visible
      expect(screen.getByText('连接 #1')).toBeInTheDocument();
      expect(screen.getByText('连接类型')).toBeInTheDocument();
    });

    it('should switch to tools section when tab is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      const toolsTab = screen.getByText(/工具定义/);
      await user.click(toolsTab);
      
      // Tools section should show empty state
      expect(screen.getByText('暂无工具定义')).toBeInTheDocument();
    });
  });

  describe('Connection Management', () => {
    it('should add a new connection when add button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Switch to connections tab
      const connectionsTab = screen.getByText(/连接配置/);
      await user.click(connectionsTab);
      
      // Initially there's one connection
      expect(screen.getByText('连接 #1')).toBeInTheDocument();
      
      // Add another connection
      const addButton = screen.getByText('+ 添加连接配置');
      await user.click(addButton);
      
      expect(screen.getByText('连接 #2')).toBeInTheDocument();
    });
  });

  describe('Tool Management', () => {
    it('should add a new tool when add button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      );
      
      // Switch to tools tab
      const toolsTab = screen.getByText(/工具定义/);
      await user.click(toolsTab);
      
      // Initially empty
      expect(screen.getByText('暂无工具定义')).toBeInTheDocument();
      
      // Add a tool
      const addButton = screen.getByText('+ 添加工具定义');
      await user.click(addButton);
      
      expect(screen.getByText('工具 #1')).toBeInTheDocument();
      expect(screen.queryByText('暂无工具定义')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable inputs when loading is true', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          loading={true}
        />
      );
      
      const displayNameInput = screen.getByPlaceholderText('例如: Filesystem Server') as HTMLInputElement;
      expect(displayNameInput).toBeDisabled();
    });

    it('should disable submit button when loading is true', () => {
      const onClose = vi.fn();
      const onSubmit = vi.fn();
      
      render(
        <MCPFormModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          loading={true}
        />
      );
      
      const submitButton = screen.getByText('创建');
      expect(submitButton).toBeDisabled();
    });
  });
});
