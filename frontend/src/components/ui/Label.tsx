import React from 'react';

interface LabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

/**
 * 工业风标签组件
 * 使用大写字母、宽字间距和小字号实现工业设计风格
 */
export const Label: React.FC<LabelProps> = ({ children, className = '', htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className={`
      uppercase 
      tracking-widest 
      font-bold 
      text-[10px] 
      text-gray-500
      ${className}
    `.trim()}
  >
    {children}
  </label>
);

/**
 * 标题组件
 * 使用粗体和紧凑字间距
 */
export const Heading: React.FC<LabelProps> = ({ children, className = '' }) => (
  <h1 
    className={`
      font-extrabold 
      tracking-tight 
      text-space-black
      ${className}
    `.trim()}
  >
    {children}
  </h1>
);

/**
 * 状态标签组件
 * 用于显示盈亏状态等
 */
interface StatusLabelProps {
  children: React.ReactNode;
  status: 'profit' | 'loss' | 'neutral' | 'warning' | 'info';
  className?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ children, status, className = '' }) => {
  const statusColors = {
    profit: 'text-profit-green bg-profit-green/10',
    loss: 'text-loss-red bg-loss-red/10',
    neutral: 'text-gray-500 bg-gray-100',
    warning: 'text-warning-orange bg-warning-orange/10',
    info: 'text-info-blue bg-info-blue/10',
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-1
        rounded-lg
        text-xs font-semibold
        ${statusColors[status]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
};

export default Label;
