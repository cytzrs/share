import React, { useId } from 'react';

interface InsetInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * 凹陷输入框组件
 * 使用内阴影实现凹陷效果，符合Zen-iOS Hybrid设计语言
 */
export const InsetInput: React.FC<InsetInputProps> = ({ 
  label, 
  error, 
  className = '', 
  id,
  ...props 
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label 
          htmlFor={inputId}
          className="uppercase tracking-widest font-bold text-[10px] text-gray-500"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          shadow-inner
          bg-gray-100/50
          border border-gray-200/40
          rounded-lg
          px-4 py-3
          focus:ring-2 focus:ring-space-black/20
          focus:outline-none
          transition-all duration-200
          placeholder:text-gray-400
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-loss-red ring-1 ring-loss-red/20' : ''}
          ${className}
        `.trim()}
      />
      {error && (
        <span className="text-loss-red text-xs">{error}</span>
      )}
    </div>
  );
};

export default InsetInput;
