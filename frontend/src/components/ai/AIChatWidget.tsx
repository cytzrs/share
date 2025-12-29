import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: File[];
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'ai-chat-widget-position';
const DEFAULT_POSITION = { x: 50, y: 24 }; // 距离右侧50px，距离底部24px

/**
 * AI对话悬浮组件
 * 右下角悬浮按钮 + 悬浮对话框
 */
export const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从localStorage加载位置
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(pos);
      } catch {
        // ignore
      }
    }
  }, []);

  // 保存位置到localStorage
  const savePosition = useCallback((pos: Position) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, []);

  // 拖动开始
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isOpen) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    setIsDragging(true);
  }, [isOpen, position]);

  // 拖动中
  useEffect(() => {
    if (!isDragging) return;

    let rafId: number;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      
      // 取消之前的动画帧
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        if (!dragRef.current) return;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const deltaX = dragRef.current.startX - clientX;
        const deltaY = dragRef.current.startY - clientY;
        
        const newX = Math.max(10, Math.min(window.innerWidth - 70, dragRef.current.startPosX + deltaX));
        const newY = Math.max(10, Math.min(window.innerHeight - 100, dragRef.current.startPosY + deltaY));
        
        setPosition({ x: newX, y: newY });
      });
    };

    const handleEnd = () => {
      if (rafId) cancelAnimationFrame(rafId);
      
      if (dragRef.current) {
        const deltaX = Math.abs(position.x - dragRef.current.startPosX);
        const deltaY = Math.abs(position.y - dragRef.current.startPosY);
        // 只有移动超过5px才算拖动，否则视为点击
        if (deltaX > 5 || deltaY > 5) {
          savePosition(position);
        }
      }
      setIsDragging(false);
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleEnd);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, position, savePosition]);

  // 点击打开（非拖动时）
  const handleClick = useCallback(() => {
    if (!isDragging && dragRef.current === null) {
      setIsOpen(true);
    }
  }, [isDragging]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      files: files.length > 0 ? [...files] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setFiles([]);
    setIsLoading(true);

    // 模拟AI回复
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '待对接，期待公益站大佬赞助稳定且长期的AI模型，便宜模型就行～',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 500);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除文件
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 按Enter发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <div
        className={`
          fixed z-50 flex flex-col items-center
          ${isDragging ? '' : 'transition-all duration-300'}
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}
        `}
        style={{
          right: `${position.x}px`,
          bottom: `${position.y}px`,
          willChange: isDragging ? 'right, bottom' : 'auto',
        }}
      >
        <button
          ref={buttonRef}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handleClick}
          className={`
            w-14 h-14 rounded-full
            bg-white shadow-lg hover:shadow-xl
            flex items-center justify-center
            border border-gray-200
            ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'}
            ${isDragging ? '' : 'transition-transform duration-200'}
          `}
        >
          <img src="/logo.jpeg" alt="AI" className="w-10 h-10 rounded-full object-cover pointer-events-none" />
        </button>
        {/* 说明文字 */}
        <div className="mt-1.5 px-2.5 py-1 bg-white rounded-full shadow-md text-xs text-gray-600 whitespace-nowrap pointer-events-none">
          问下AI助手～
        </div>
      </div>

      {/* 对话框 */}
      <div
        className={`
          fixed z-50
          w-96 h-[520px]
          bg-white rounded-2xl shadow-2xl
          flex flex-col overflow-hidden
          transition-all duration-300 ease-out
          origin-bottom-right
          ${isOpen 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-0 opacity-0 translate-y-4 pointer-events-none'
          }
        `}
        style={{
          right: `${position.x}px`,
          bottom: `${position.y}px`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-500">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="AI" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30" />
            <div>
              <h3 className="text-white font-medium">ddCat助手</h3>
              <p className="text-white/70 text-xs">随时为您服务</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
                <img src="/logo.jpeg" alt="AI" className="w-10 h-10 rounded-full object-cover opacity-60" />
              </div>
              <p className="text-gray-400 text-sm">有什么可以帮您的？</p>
              <p className="text-gray-400 text-sm">
                <span>不作为投资建议</span>
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-2xl px-4 py-2.5
                  ${msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-md'
                    : 'bg-white text-gray-700 shadow-sm border border-gray-100 rounded-bl-md'
                  }
                `}
              >
                {/* 文件附件 */}
                {msg.files && msg.files.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {msg.files.map((file, idx) => (
                      <div
                        key={idx}
                        className={`
                          flex items-center gap-2 text-xs px-2 py-1 rounded
                          ${msg.role === 'user' ? 'bg-white/20' : 'bg-gray-50'}
                        `}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {/* 加载中 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 文件预览 */}
        {files.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg text-xs text-gray-600 border border-gray-200"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区域 */}
        <div className="p-3 bg-white border-t border-gray-100">
          <div className="flex items-end gap-2">
            {/* 文件上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              title="上传文件"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* 输入框 */}
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                rows={1}
                className="w-full px-4 py-2.5 pr-12 rounded-xl bg-gray-100 border-none outline-none resize-none text-sm focus:ring-2 focus:ring-blue-500/30 transition-shadow"
                style={{ maxHeight: '120px' }}
              />
              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && files.length === 0)}
                className="absolute right-2 bottom-1.5 p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatWidget;
