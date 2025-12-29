import React, { useState, useEffect, useCallback } from 'react';
import { stockApi, type CompanyProfile, type Shareholder } from '../../../services/api';
import { GlassCard } from '../../ui';

export interface ProfileTabProps {
  stockCode: string;
}

/**
 * 格式化数字（亿/万）
 */
function formatNumber(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿';
  }
  if (absValue >= 10000) {
    return (value / 10000).toFixed(2) + '万';
  }
  return value.toFixed(2);
}

/**
 * 格式化股本（亿股/万股）
 */
function formatShares(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿股';
  }
  if (absValue >= 10000) {
    return (value / 10000).toFixed(2) + '万股';
  }
  return value.toFixed(0) + '股';
}

/**
 * 格式化百分比
 */
function formatPercentage(value: number): string {
  return value.toFixed(2) + '%';
}

/**
 * 简况标签页组件
 * 显示公司基本信息、业务描述、十大股东、高管信息
 * 需求: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const ProfileTab: React.FC<ProfileTabProps> = ({ stockCode }) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载公司简况数据
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileResponse, shareholdersResponse] = await Promise.all([
        stockApi.getProfile(stockCode),
        stockApi.getShareholders(stockCode),
      ]);
      
      setProfile(profileResponse);
      setShareholders(shareholdersResponse.shareholders || []);
    } catch (err) {
      console.error('加载公司简况失败:', err);
      setError('加载公司简况失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [stockCode]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4" data-testid="profile-tab-loading">
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 rounded-[7px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-4" data-testid="profile-tab-error">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadProfileData}
              className="px-4 py-2 bg-space-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
            >
              重试
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 空数据状态
  if (!profile) {
    return (
      <div className="space-y-4" data-testid="profile-tab-empty">
        <GlassCard className="p-8 rounded-[7px]">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-400">暂无公司简况数据</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="profile-tab">
      {/* 公司基本信息 */}
      <GlassCard className="p-4 rounded-[7px]">
        <h3 className="text-sm font-medium text-gray-700 mb-4">公司基本信息</h3>
        <CompanyBasicInfo profile={profile} />
      </GlassCard>

      {/* 业务描述 */}
      {(profile.description || profile.main_business) && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">业务描述</h3>
          <BusinessDescription profile={profile} />
        </GlassCard>
      )}

      {/* 十大股东 */}
      {shareholders.length > 0 && (
        <GlassCard className="p-4 rounded-[7px]">
          <h3 className="text-sm font-medium text-gray-700 mb-3">十大股东</h3>
          <ShareholderList shareholders={shareholders} />
        </GlassCard>
      )}
    </div>
  );
};

/**
 * 公司基本信息组件
 */
interface CompanyBasicInfoProps {
  profile: CompanyProfile;
}

export const CompanyBasicInfo: React.FC<CompanyBasicInfoProps> = ({ profile }) => {
  const infoItems = [
    { label: '公司名称', value: profile.name, testId: 'info-name' },
    { label: '英文名称', value: profile.english_name || '-', testId: 'info-english-name' },
    { label: '所属行业', value: profile.industry || '-', testId: 'info-industry' },
    { label: '上市日期', value: profile.list_date || '-', testId: 'info-list-date' },
    { label: '总股本', value: profile.total_shares ? formatShares(profile.total_shares) : '-', testId: 'info-total-shares' },
    { label: '流通股本', value: profile.circulating_shares ? formatShares(profile.circulating_shares) : '-', testId: 'info-circulating-shares' },
    { label: '注册资本', value: profile.registered_capital ? formatNumber(profile.registered_capital) + '元' : '-', testId: 'info-registered-capital' },
    { label: '员工人数', value: profile.employees ? profile.employees.toLocaleString() + '人' : '-', testId: 'info-employees' },
    { label: '所在地区', value: [profile.province, profile.city].filter(Boolean).join(' ') || '-', testId: 'info-location' },
    { label: '公司网站', value: profile.website || '-', testId: 'info-website', isLink: !!profile.website },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm" data-testid="company-basic-info">
      {infoItems.map((item, index) => (
        <div key={index} className="flex" data-testid={item.testId}>
          <span className="text-gray-500 w-20 flex-shrink-0">{item.label}</span>
          {item.isLink && item.value !== '-' ? (
            <a
              href={item.value.startsWith('http') ? item.value : `http://${item.value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate"
            >
              {item.value}
            </a>
          ) : (
            <span className="text-gray-900 truncate" title={item.value}>{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * 业务描述组件
 */
interface BusinessDescriptionProps {
  profile: CompanyProfile;
}

export const BusinessDescription: React.FC<BusinessDescriptionProps> = ({ profile }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid="business-description">
      {profile.main_business && (
        <div className="mb-3">
          <span className="text-xs text-gray-500 font-medium">主营业务：</span>
          <p className="text-sm text-gray-700 mt-1" data-testid="main-business">
            {profile.main_business}
          </p>
        </div>
      )}
      {profile.description && (
        <div>
          <span className="text-xs text-gray-500 font-medium">公司简介：</span>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-line" data-testid="company-description">
            {expanded || profile.description.length <= 200 
              ? profile.description 
              : profile.description.slice(0, 200) + '...'}
          </p>
          {profile.description.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-600 hover:underline mt-2"
              data-testid="expand-button"
            >
              {expanded ? '收起' : '展开全部'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 股东列表组件
 */
interface ShareholderListProps {
  shareholders: Shareholder[];
}

export const ShareholderList: React.FC<ShareholderListProps> = ({ shareholders }) => {
  return (
    <div className="overflow-x-auto" data-testid="shareholder-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-100">
            <th className="text-left py-2 font-medium">排名</th>
            <th className="text-left py-2 font-medium">股东名称</th>
            <th className="text-right py-2 font-medium">持股数量</th>
            <th className="text-right py-2 font-medium">持股比例</th>
            <th className="text-left py-2 font-medium">股东性质</th>
          </tr>
        </thead>
        <tbody>
          {shareholders.slice(0, 10).map((shareholder, index) => (
            <tr 
              key={index} 
              className="border-b border-gray-50 hover:bg-gray-50/50"
              data-testid={`shareholder-${index}`}
            >
              <td className="py-2 text-gray-500">{index + 1}</td>
              <td className="py-2 text-gray-900" data-testid={`shareholder-name-${index}`}>
                {shareholder.name}
              </td>
              <td className="py-2 text-right text-gray-700" data-testid={`shareholder-shares-${index}`}>
                {formatShares(shareholder.shares)}
              </td>
              <td className="py-2 text-right text-gray-700" data-testid={`shareholder-percentage-${index}`}>
                {formatPercentage(shareholder.percentage)}
              </td>
              <td className="py-2 text-gray-500" data-testid={`shareholder-nature-${index}`}>
                {shareholder.nature || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProfileTab;
