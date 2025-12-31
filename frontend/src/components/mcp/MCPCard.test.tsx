import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MCPCard } from './MCPCard';
import type { MCPServer } from '../../types';

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

// Helper function to create a mock MCP server
const createMockServer = (overrides: Partial<MCPServer> = {}): MCPServer => ({
  server_id: 1,
  qualified_name: 'test-server',
  display_name: 'Test Server',
  description: 'A test MCP server',
  logo: 'https://example.com/logo.png',
  creator: 'Test Creator',
  type: 1,
  tag: 'test,demo,example',
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

describe('MCPCard', () => {
  /**
   * Requirements: 8.2
   * WHEN 展示MCP卡片 THEN THE MCP_Marketplace SHALL 显示：logo、display_name、description、creator、tag标签、use_count、状态标识
   */
  describe('Card Display Requirements (8.2)', () => {
    it('should render display_name correctly', () => {
      const server = createMockServer({ display_name: 'My MCP Server' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('My MCP Server')).toBeInTheDocument();
    });

    it('should render description correctly', () => {
      const server = createMockServer({ description: 'This is a detailed description' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('This is a detailed description')).toBeInTheDocument();
    });

    it('should render creator correctly', () => {
      const server = createMockServer({ creator: 'John Doe' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('by John Doe')).toBeInTheDocument();
    });

    it('should render tags correctly', () => {
      const server = createMockServer({ tag: 'api,database,cloud' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();
      expect(screen.getByText('cloud')).toBeInTheDocument();
    });

    it('should render use_count correctly', () => {
      const server = createMockServer({ use_count: 1234 });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should render enabled status correctly', () => {
      const server = createMockServer({ is_enabled: true });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('已启用')).toBeInTheDocument();
    });

    it('should render disabled status correctly', () => {
      const server = createMockServer({ is_enabled: false });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('已停用')).toBeInTheDocument();
    });

    it('should render tools count correctly', () => {
      const server = createMockServer({
        tools: [
          { tool_id: 1, name: 'tool1', description: 'Tool 1' },
          { tool_id: 2, name: 'tool2', description: 'Tool 2' },
          { tool_id: 3, name: 'tool3', description: 'Tool 3' },
        ],
      });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render logo image when provided', () => {
      const server = createMockServer({ logo: 'https://example.com/logo.png' });
      render(<MCPCard server={server} />);
      
      const logo = screen.getByRole('img');
      expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
    });

    it('should render fallback initial when no logo provided', () => {
      const server = createMockServer({ logo: undefined, display_name: 'Test Server' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should limit displayed tags to 3 and show overflow count', () => {
      const server = createMockServer({ tag: 'tag1,tag2,tag3,tag4,tag5' });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('Interaction Tests', () => {
    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const server = createMockServer();
      
      render(<MCPCard server={server} onClick={onClick} />);
      
      const card = screen.getByText('Test Server').closest('div');
      await user.click(card!);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onClick = vi.fn();
      const server = createMockServer();
      
      render(<MCPCard server={server} onClick={onClick} onEdit={onEdit} />);
      
      const editButton = screen.getByText('编辑');
      await user.click(editButton);
      
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled(); // Should stop propagation
    });

    it('should call onToggleStatus when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleStatus = vi.fn();
      const onClick = vi.fn();
      const server = createMockServer({ is_enabled: true });
      
      render(<MCPCard server={server} onClick={onClick} onToggleStatus={onToggleStatus} />);
      
      const toggleButton = screen.getByText('停用');
      await user.click(toggleButton);
      
      expect(onToggleStatus).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled(); // Should stop propagation
    });

    it('should show "启用" button when server is disabled', () => {
      const onToggleStatus = vi.fn();
      const server = createMockServer({ is_enabled: false });
      
      render(<MCPCard server={server} onToggleStatus={onToggleStatus} />);
      
      expect(screen.getByText('启用')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty description', () => {
      const server = createMockServer({ description: undefined });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('Test Server')).toBeInTheDocument();
    });

    it('should handle empty tags', () => {
      const server = createMockServer({ tag: undefined });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('Test Server')).toBeInTheDocument();
    });

    it('should handle empty creator', () => {
      const server = createMockServer({ creator: undefined });
      render(<MCPCard server={server} />);
      
      expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
    });

    it('should handle zero use_count', () => {
      const server = createMockServer({ use_count: 0 });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle empty tools array', () => {
      const server = createMockServer({ tools: [] });
      render(<MCPCard server={server} />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render created date correctly', () => {
      const server = createMockServer({ created_at: '2024-01-15T10:30:00.000Z' });
      render(<MCPCard server={server} />);
      
      // The date format depends on locale, so we check for the presence of the date text
      expect(screen.getByText(/创建于/)).toBeInTheDocument();
    });
  });
});
