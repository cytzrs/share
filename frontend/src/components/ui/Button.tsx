import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

/**
 * 主按钮 - 深空黑
 * 具有触觉反馈效果（按下缩放）
 */
export const PrimaryButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`
      bg-space-black text-white
      px-6 py-3
      rounded-[7px]
      font-bold tracking-tight
      active:scale-[0.98]
      hover:bg-graphite
      transition-all duration-150
      shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)]
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}
    `.trim()}
  >
    {children}
  </button>
);

/**
 * 次级按钮 - 白色玻璃
 * 具有触觉反馈效果（按下缩放）
 */
export const SecondaryButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`
      bg-white
      border border-gray-200/60
      px-6 py-3
      rounded-[7px]
      font-semibold
      active:scale-95
      hover:backdrop-blur-3xl hover:border-gray-300
      transition-all duration-150
      shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}
    `.trim()}
  >
    {children}
  </button>
);

/**
 * 通用按钮组件，支持variant属性切换样式
 */
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', ...props }) => {
  if (variant === 'secondary') {
    return <SecondaryButton {...props} />;
  }
  return <PrimaryButton {...props} />;
};

export default Button;
