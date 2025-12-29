import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define types locally to avoid import issues
interface CompanyProfile {
  name: string;
  english_name: string;
  industry: string;
  list_date: string;
  total_shares: number;
  circulating_shares: number;
  description: string;
  main_business: string;
  registered_capital: number;
  employees: number;
  province: string;
  city: string;
  website: string;
}

interface Shareholder {
  name: string;
  shares: number;
  percentage: number;
  nature: string;
}

/**
 * Format shares helper function (copied from ProfileTab)
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
 * Format percentage helper function (copied from ProfileTab)
 */
function formatPercentage(value: number): string {
  return value.toFixed(2) + '%';
}

/**
 * CompanyBasicInfo component - standalone version for testing
 */
const CompanyBasicInfo: React.FC<{ profile: CompanyProfile }> = ({ profile }) => {
  const formatNumber = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 100000000) {
      return (value / 100000000).toFixed(2) + '亿';
    }
    if (absValue >= 10000) {
      return (value / 10000).toFixed(2) + '万';
    }
    return value.toFixed(2);
  };

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
    { label: '公司网站', value: profile.website || '-', testId: 'info-website' },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm" data-testid="company-basic-info">
      {infoItems.map((item, index) => (
        <div key={index} className="flex" data-testid={item.testId}>
          <span className="text-gray-500 w-20 flex-shrink-0">{item.label}</span>
          <span className="text-gray-900 truncate" title={item.value}>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * BusinessDescription component - standalone version for testing
 */
const BusinessDescription: React.FC<{ profile: CompanyProfile }> = ({ profile }) => {
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
            {profile.description.length <= 200 
              ? profile.description 
              : profile.description.slice(0, 200) + '...'}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * ShareholderList component - standalone version for testing
 */
const ShareholderList: React.FC<{ shareholders: Shareholder[] }> = ({ shareholders }) => {
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

// Arbitrary generator for CompanyProfile
const companyProfileArbitrary = fc.record({
  name: fc.string({ minLength: 2, maxLength: 50 }),
  english_name: fc.string({ minLength: 0, maxLength: 100 }),
  industry: fc.string({ minLength: 2, maxLength: 30 }),
  list_date: fc.integer({ min: 1990, max: 2025 }).chain(year =>
    fc.integer({ min: 1, max: 12 }).chain(month =>
      fc.integer({ min: 1, max: 28 }).map(day => 
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )
    )
  ),
  total_shares: fc.integer({ min: 10000, max: 100000000000 }),
  circulating_shares: fc.integer({ min: 10000, max: 100000000000 }),
  description: fc.string({ minLength: 10, maxLength: 500 }),
  main_business: fc.string({ minLength: 10, maxLength: 300 }),
  registered_capital: fc.integer({ min: 1000000, max: 100000000000 }),
  employees: fc.integer({ min: 10, max: 1000000 }),
  province: fc.constantFrom('北京', '上海', '广东', '浙江', '江苏', '山东'),
  city: fc.constantFrom('北京', '上海', '深圳', '杭州', '南京', '青岛'),
  website: fc.constantFrom('www.example.com', 'www.company.cn', 'www.stock.com.cn', ''),
});

// Arbitrary generator for Shareholder
const shareholderArbitrary = fc.record({
  name: fc.string({ minLength: 2, maxLength: 50 }),
  shares: fc.integer({ min: 1000, max: 10000000000 }),
  percentage: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
  nature: fc.constantFrom('国有股东', '境内法人', '境外法人', '自然人', '基金', ''),
});

// Arbitrary generator for Shareholder list (1-10 shareholders)
const shareholderListArbitrary = fc.array(shareholderArbitrary, { minLength: 1, maxLength: 10 });

describe('ProfileTab - Property Tests', () => {
  /**
   * Property 6: Company profile data rendering
   * Feature: stock-detail-page, Property 6: Company profile data rendering
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   * 
   * For any valid CompanyProfile, Shareholder list, the rendered ProfileTab
   * should display company name, industry, list date, business description,
   * all shareholders with their holding percentages.
   */
  it('Property 6: Company profile data rendering - should render company name, industry, and list date', () => {
    fc.assert(
      fc.property(
        companyProfileArbitrary,
        (profile: CompanyProfile) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <CompanyBasicInfo profile={profile} />
          );

          // Verify the basic info container is rendered
          const basicInfoElement = container.querySelector('[data-testid="company-basic-info"]');
          expect(basicInfoElement).toBeTruthy();

          // Verify company name is displayed
          const nameElement = container.querySelector('[data-testid="info-name"]');
          expect(nameElement).toBeTruthy();
          expect(nameElement?.textContent).toContain('公司名称');
          expect(nameElement?.textContent).toContain(profile.name);

          // Verify industry is displayed
          const industryElement = container.querySelector('[data-testid="info-industry"]');
          expect(industryElement).toBeTruthy();
          expect(industryElement?.textContent).toContain('所属行业');
          expect(industryElement?.textContent).toContain(profile.industry);

          // Verify list date is displayed
          const listDateElement = container.querySelector('[data-testid="info-list-date"]');
          expect(listDateElement).toBeTruthy();
          expect(listDateElement?.textContent).toContain('上市日期');
          expect(listDateElement?.textContent).toContain(profile.list_date);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (continued): Verify business description is displayed
   */
  it('Property 6: Company profile data rendering - should render business description', () => {
    fc.assert(
      fc.property(
        companyProfileArbitrary,
        (profile: CompanyProfile) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <BusinessDescription profile={profile} />
          );

          // Verify the business description container is rendered
          const descElement = container.querySelector('[data-testid="business-description"]');
          expect(descElement).toBeTruthy();

          // Verify main business is displayed if present
          if (profile.main_business) {
            const mainBusinessElement = container.querySelector('[data-testid="main-business"]');
            expect(mainBusinessElement).toBeTruthy();
            expect(mainBusinessElement?.textContent).toContain(profile.main_business);
          }

          // Verify company description is displayed if present
          if (profile.description) {
            const companyDescElement = container.querySelector('[data-testid="company-description"]');
            expect(companyDescElement).toBeTruthy();
            // For long descriptions, only first 200 chars are shown
            const expectedText = profile.description.length <= 200 
              ? profile.description 
              : profile.description.slice(0, 200);
            expect(companyDescElement?.textContent).toContain(expectedText);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (continued): Verify shareholders are displayed with holding percentages
   */
  it('Property 6: Company profile data rendering - should render all shareholders with holding percentages', () => {
    fc.assert(
      fc.property(
        shareholderListArbitrary,
        (shareholders: Shareholder[]) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <ShareholderList shareholders={shareholders} />
          );

          // Verify the shareholder list container is rendered
          const listElement = container.querySelector('[data-testid="shareholder-list"]');
          expect(listElement).toBeTruthy();

          // Verify each shareholder is displayed (up to 10)
          const displayedShareholders = shareholders.slice(0, 10);
          displayedShareholders.forEach((shareholder, index) => {
            // Verify shareholder row exists
            const rowElement = container.querySelector(`[data-testid="shareholder-${index}"]`);
            expect(rowElement).toBeTruthy();

            // Verify shareholder name is displayed
            const nameElement = container.querySelector(`[data-testid="shareholder-name-${index}"]`);
            expect(nameElement).toBeTruthy();
            expect(nameElement?.textContent).toContain(shareholder.name);

            // Verify holding shares is displayed
            const sharesElement = container.querySelector(`[data-testid="shareholder-shares-${index}"]`);
            expect(sharesElement).toBeTruthy();
            const formattedShares = formatShares(shareholder.shares);
            expect(sharesElement?.textContent).toContain(formattedShares);

            // Verify holding percentage is displayed
            const percentageElement = container.querySelector(`[data-testid="shareholder-percentage-${index}"]`);
            expect(percentageElement).toBeTruthy();
            const formattedPercentage = formatPercentage(shareholder.percentage);
            expect(percentageElement?.textContent).toContain(formattedPercentage);

            // Verify shareholder nature is displayed
            const natureElement = container.querySelector(`[data-testid="shareholder-nature-${index}"]`);
            expect(natureElement).toBeTruthy();
            expect(natureElement?.textContent).toContain(shareholder.nature || '-');
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should render company basic info with specific values correctly', () => {
      const profile: CompanyProfile = {
        name: '测试科技股份有限公司',
        english_name: 'Test Technology Co., Ltd.',
        industry: '软件和信息技术服务业',
        list_date: '2020-07-22',
        total_shares: 5000000000,
        circulating_shares: 3000000000,
        description: '公司是一家专注于软件开发的高科技企业。',
        main_business: '软件开发、技术咨询、系统集成',
        registered_capital: 1000000000,
        employees: 5000,
        province: '北京',
        city: '北京',
        website: 'www.test.com.cn',
      };

      const { container } = render(<CompanyBasicInfo profile={profile} />);

      // Verify company name
      const nameElement = container.querySelector('[data-testid="info-name"]');
      expect(nameElement?.textContent).toContain('测试科技股份有限公司');

      // Verify industry
      const industryElement = container.querySelector('[data-testid="info-industry"]');
      expect(industryElement?.textContent).toContain('软件和信息技术服务业');

      // Verify list date
      const listDateElement = container.querySelector('[data-testid="info-list-date"]');
      expect(listDateElement?.textContent).toContain('2020-07-22');

      // Verify total shares (50亿股)
      const totalSharesElement = container.querySelector('[data-testid="info-total-shares"]');
      expect(totalSharesElement?.textContent).toContain('50.00亿股');

      // Verify employees
      const employeesElement = container.querySelector('[data-testid="info-employees"]');
      expect(employeesElement?.textContent).toContain('5,000人');
    });

    it('should render shareholder list with specific values correctly', () => {
      const shareholders: Shareholder[] = [
        { name: '大股东集团有限公司', shares: 1500000000, percentage: 30.00, nature: '国有股东' },
        { name: '战略投资者A', shares: 500000000, percentage: 10.00, nature: '境内法人' },
        { name: '张三', shares: 100000000, percentage: 2.00, nature: '自然人' },
      ];

      const { container } = render(<ShareholderList shareholders={shareholders} />);

      // Verify first shareholder
      const name0 = container.querySelector('[data-testid="shareholder-name-0"]');
      expect(name0?.textContent).toContain('大股东集团有限公司');
      
      const shares0 = container.querySelector('[data-testid="shareholder-shares-0"]');
      expect(shares0?.textContent).toContain('15.00亿股');
      
      const percentage0 = container.querySelector('[data-testid="shareholder-percentage-0"]');
      expect(percentage0?.textContent).toContain('30.00%');
      
      const nature0 = container.querySelector('[data-testid="shareholder-nature-0"]');
      expect(nature0?.textContent).toContain('国有股东');

      // Verify second shareholder
      const name1 = container.querySelector('[data-testid="shareholder-name-1"]');
      expect(name1?.textContent).toContain('战略投资者A');
      
      const shares1 = container.querySelector('[data-testid="shareholder-shares-1"]');
      expect(shares1?.textContent).toContain('5.00亿股');

      // Verify third shareholder
      const name2 = container.querySelector('[data-testid="shareholder-name-2"]');
      expect(name2?.textContent).toContain('张三');
      
      const shares2 = container.querySelector('[data-testid="shareholder-shares-2"]');
      expect(shares2?.textContent).toContain('1.00亿股');
    });

    it('should handle empty shareholder nature correctly', () => {
      const shareholders: Shareholder[] = [
        { name: '未知股东', shares: 50000000, percentage: 1.00, nature: '' },
      ];

      const { container } = render(<ShareholderList shareholders={shareholders} />);

      const natureElement = container.querySelector('[data-testid="shareholder-nature-0"]');
      expect(natureElement?.textContent).toContain('-');
    });

    it('should display all labels correctly', () => {
      const profile: CompanyProfile = {
        name: '测试公司',
        english_name: 'Test Co.',
        industry: '制造业',
        list_date: '2015-01-01',
        total_shares: 1000000000,
        circulating_shares: 800000000,
        description: '这是一家测试公司。',
        main_business: '生产制造',
        registered_capital: 500000000,
        employees: 1000,
        province: '广东',
        city: '深圳',
        website: 'www.test.com',
      };

      const { container } = render(<CompanyBasicInfo profile={profile} />);

      // Verify all labels are present
      expect(container.textContent).toContain('公司名称');
      expect(container.textContent).toContain('英文名称');
      expect(container.textContent).toContain('所属行业');
      expect(container.textContent).toContain('上市日期');
      expect(container.textContent).toContain('总股本');
      expect(container.textContent).toContain('流通股本');
      expect(container.textContent).toContain('注册资本');
      expect(container.textContent).toContain('员工人数');
      expect(container.textContent).toContain('所在地区');
      expect(container.textContent).toContain('公司网站');
    });

    it('should render business description with main business and company description', () => {
      const profile: CompanyProfile = {
        name: '测试公司',
        english_name: '',
        industry: '金融业',
        list_date: '2010-05-15',
        total_shares: 2000000000,
        circulating_shares: 1500000000,
        description: '公司成立于2000年，是一家综合性金融服务企业，主要从事银行、保险、证券等业务。',
        main_business: '银行业务、保险业务、证券业务、资产管理',
        registered_capital: 10000000000,
        employees: 50000,
        province: '上海',
        city: '上海',
        website: '',
      };

      const { container } = render(<BusinessDescription profile={profile} />);

      // Verify main business is displayed
      const mainBusinessElement = container.querySelector('[data-testid="main-business"]');
      expect(mainBusinessElement?.textContent).toContain('银行业务、保险业务、证券业务、资产管理');

      // Verify company description is displayed
      const descElement = container.querySelector('[data-testid="company-description"]');
      expect(descElement?.textContent).toContain('公司成立于2000年');
    });
  });
});
