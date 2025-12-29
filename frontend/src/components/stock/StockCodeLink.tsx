import React from 'react';

interface StockCodeLinkProps {
  code: string;
  name?: string;  // 从后端获取的股票名称
  onClick: (code: string) => void;
  className?: string;
  showName?: boolean;  // 是否显示股票名称
  children?: React.ReactNode;
}

/**
 * 可点击的股票代码组件
 * 点击后触发回调，用于打开股票详情抽屉
 */
export const StockCodeLink: React.FC<StockCodeLinkProps> = ({ 
  code, 
  name,
  onClick, 
  className = '',
  showName = true,
  children 
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(code);
      }}
      className={`text-info-blue hover:underline cursor-pointer font-medium ${className}`}
    >
      {children || (
        <>
          {code}
          {showName && name && <span className="text-gray-500 font-normal ml-1">{name}</span>}
        </>
      )}
    </button>
  );
};

export default StockCodeLink;
