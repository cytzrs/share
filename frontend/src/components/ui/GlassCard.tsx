import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 毛玻璃容器组件
 * 使用backdrop-blur和半透明背景实现iOS风格的毛玻璃效果
 */
export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => (
  <div
    className={`
      backdrop-blur-[50px]
      bg-glass-white-50
      border border-glass-white-60
      ring-1 ring-gray-200/40
      shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)]
      rounded-[10px]
      p-6
      ${className}
    `.trim()}
  >
    {children}
  </div>
);

export default GlassCard;
