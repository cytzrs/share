import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { StockDetailDrawer } from './StockDetailDrawer';
import * as api from '../../services/api';

// Mock the tab components to avoid deep dependency issues
vi.mock('./tabs/OverviewTab', () => ({
  OverviewTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="overview-tab-content">Overview Tab: {stockCode}</div>
  ),
}));

vi.mock('./tabs/CapitalTab', () => ({
  CapitalTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="capital-tab-content">Capital Tab: {stockCode}</div>
  ),
}));

vi.mock('./tabs/ProfileTab', () => ({
  ProfileTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="profile-tab-content">Profile Tab: {stockCode}</div>
  ),
}));

vi.mock('./tabs/NewsTab', () => ({
  NewsTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="news-tab-content">News Tab: {stockCode}</div>
  ),
}));

vi.mock('./tabs/FinanceTab', () => ({
  FinanceTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="finance-tab-content">Finance Tab: {stockCode}</div>
  ),
}));

vi.mock('./tabs/AIAnalysisTab', () => ({
  AIAnalysisTab: ({ stockCode }: { stockCode: string }) => (
    <div data-testid="ai-analysis-tab-content">AI Analysis Tab: {stockCode}</div>
  ),
}));

// Mock the API module
vi.mock('../../services/api', async () => {
  const actual = await vi.importActual('../../services/api');
  return {
    ...actual,
    stockApi: {
      getInfo: vi.fn(),
      getQuote: vi.fn(),
      getKLine: vi.fn(),
      getCapitalFlow: vi.fn(),
      getCapitalDistribution: vi.fn(),
      getProfile: vi.fn(),
      getShareholders: vi.fn(),
      getNews: vi.fn(),
      getAnalystRatings: vi.fn(),
      getFinancials: vi.fn(),
      getBalanceSheet: vi.fn(),
      getCashFlow: vi.fn(),
      getAIAnalysis: vi.fn(),
      generateAIAnalysis: vi.fn(),
    },
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock data generators
const mockStockInfo: api.StockBasicInfo = {
  code: '600000',
  name: '浦发银行',
  market: 'SH',
  industry: '银行',
  list_date: '1999-11-10',
};

const mockQuote: api.StockRealtimeQuote = {
  price: 10.5,
  change: 0.2,
  change_pct: 1.94,
  open: 10.3,
  high: 10.6,
  low: 10.2,
  prev_close: 10.3,
  volume: 50000000,
  amount: 5200000000,
  turnover_rate: 1.5,
  pe: 5.2,
  pb: 0.5,
  market_cap: 300000000000,
  updated_at: new Date().toISOString(),
};

// Tab types for property testing
type TabType = 'overview' | 'capital' | 'profile' | 'news' | 'finance' | 'ai-analysis';
const ALL_TABS: TabType[] = ['overview', 'capital', 'profile', 'news', 'finance', 'ai-analysis'];

// Arbitrary generator for tab sequences
const tabSequenceArbitrary = fc.array(
  fc.constantFrom(...ALL_TABS),
  { minLength: 1, maxLength: 20 }
);

describe('StockDetailDrawer', () => {
  beforeEach(() => {
    // Setup default mock implementations
    vi.mocked(api.stockApi.getInfo).mockResolvedValue(mockStockInfo);
    vi.mocked(api.stockApi.getQuote).mockResolvedValue(mockQuote);
    vi.mocked(api.stockApi.getKLine).mockResolvedValue({ stock_code: '600000', period: 'daily', data: [] });
    vi.mocked(api.stockApi.getCapitalFlow).mockResolvedValue({ stock_code: '600000', data: [] });
    vi.mocked(api.stockApi.getCapitalDistribution).mockResolvedValue({
      stock_code: '600000',
      super_large: { inflow: 0, outflow: 0, net: 0 },
      large: { inflow: 0, outflow: 0, net: 0 },
      medium: { inflow: 0, outflow: 0, net: 0 },
      small: { inflow: 0, outflow: 0, net: 0 },
    });
    vi.mocked(api.stockApi.getProfile).mockResolvedValue({
      name: '浦发银行',
      english_name: 'SPD Bank',
      industry: '银行',
      list_date: '1999-11-10',
      total_shares: 29380000000,
      circulating_shares: 29380000000,
      description: '上海浦东发展银行',
      main_business: '商业银行业务',
      registered_capital: 29380000000,
      employees: 50000,
      province: '上海',
      city: '上海',
      website: 'www.spdb.com.cn',
    });
    vi.mocked(api.stockApi.getShareholders).mockResolvedValue({ stock_code: '600000', shareholders: [] });
    vi.mocked(api.stockApi.getNews).mockResolvedValue({ stock_code: '600000', page: 1, page_size: 20, data: [] });
    vi.mocked(api.stockApi.getAnalystRatings).mockResolvedValue({ stock_code: '600000', ratings: [] });
    vi.mocked(api.stockApi.getFinancials).mockResolvedValue({ stock_code: '600000', report_type: 'quarterly', data: [] });
    vi.mocked(api.stockApi.getBalanceSheet).mockResolvedValue({ stock_code: '600000', data: [] });
    vi.mocked(api.stockApi.getCashFlow).mockResolvedValue({ stock_code: '600000', data: [] });
    vi.mocked(api.stockApi.getAIAnalysis).mockResolvedValue(null);
  });

  /**
   * Property 3: Tab navigation state consistency
   * Feature: stock-detail-page, Property 3: Tab navigation state consistency
   * Validates: Requirements 2.2, 2.3
   * 
   * For any sequence of tab clicks, the active tab state should always match
   * the last clicked tab, and clicking the same tab multiple times should not
   * change the state.
   */
  it('Property 3: Tab navigation state consistency - active tab should match last clicked tab', async () => {
    const user = userEvent.setup();
    
    await fc.assert(
      fc.asyncProperty(
        tabSequenceArbitrary,
        async (tabSequence: TabType[]) => {
          // Clean up before each iteration
          cleanup();
          vi.clearAllMocks();
          
          // Re-setup mocks
          vi.mocked(api.stockApi.getInfo).mockResolvedValue(mockStockInfo);
          vi.mocked(api.stockApi.getQuote).mockResolvedValue(mockQuote);
          vi.mocked(api.stockApi.getKLine).mockResolvedValue({ stock_code: '600000', period: 'daily', data: [] });
          vi.mocked(api.stockApi.getCapitalFlow).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getCapitalDistribution).mockResolvedValue({
            stock_code: '600000',
            super_large: { inflow: 0, outflow: 0, net: 0 },
            large: { inflow: 0, outflow: 0, net: 0 },
            medium: { inflow: 0, outflow: 0, net: 0 },
            small: { inflow: 0, outflow: 0, net: 0 },
          });
          vi.mocked(api.stockApi.getProfile).mockResolvedValue({
            name: '浦发银行',
            english_name: 'SPD Bank',
            industry: '银行',
            list_date: '1999-11-10',
            total_shares: 29380000000,
            circulating_shares: 29380000000,
            description: '上海浦东发展银行',
            main_business: '商业银行业务',
            registered_capital: 29380000000,
            employees: 50000,
            province: '上海',
            city: '上海',
            website: 'www.spdb.com.cn',
          });
          vi.mocked(api.stockApi.getShareholders).mockResolvedValue({ stock_code: '600000', shareholders: [] });
          vi.mocked(api.stockApi.getNews).mockResolvedValue({ stock_code: '600000', page: 1, page_size: 20, data: [] });
          vi.mocked(api.stockApi.getAnalystRatings).mockResolvedValue({ stock_code: '600000', ratings: [] });
          vi.mocked(api.stockApi.getFinancials).mockResolvedValue({ stock_code: '600000', report_type: 'quarterly', data: [] });
          vi.mocked(api.stockApi.getBalanceSheet).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getCashFlow).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getAIAnalysis).mockResolvedValue(null);
          
          const onClose = vi.fn();
          
          const { container, unmount } = render(
            <StockDetailDrawer stockCode="600000" onClose={onClose} />
          );

          // Wait for initial data load - wait for stock header to appear (not skeleton)
          await waitFor(() => {
            expect(container.querySelector('[data-testid="stock-header"]')).toBeTruthy();
          });

          // Click through the tab sequence
          for (const tab of tabSequence) {
            const tabButton = container.querySelector(`[data-testid="tab-${tab}"]`);
            if (tabButton) {
              await user.click(tabButton);
            }
          }

          // The last tab in the sequence should be active
          const lastTab = tabSequence[tabSequence.length - 1];
          const activeTabButton = container.querySelector(`[data-testid="tab-${lastTab}"]`);
          
          // Verify the last clicked tab has the active styling (border-space-black)
          expect(activeTabButton?.classList.contains('border-space-black')).toBe(true);
          expect(activeTabButton?.classList.contains('text-space-black')).toBe(true);

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Property 17: Refresh button triggers data reload
   * Feature: stock-detail-page, Property 17: Refresh button triggers data reload
   * Validates: Requirements 11.3
   * 
   * For any active tab, clicking the refresh button should trigger a new fetch
   * for that tab's data, and the loading state should be true during the fetch.
   */
  it('Property 17: Refresh button triggers data reload - should call API when refresh is clicked', async () => {
    const user = userEvent.setup();
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ALL_TABS),
        async (activeTab: TabType) => {
          // Clean up before each iteration
          cleanup();
          vi.clearAllMocks();
          
          // Re-setup mocks
          vi.mocked(api.stockApi.getInfo).mockResolvedValue(mockStockInfo);
          vi.mocked(api.stockApi.getQuote).mockResolvedValue(mockQuote);
          vi.mocked(api.stockApi.getKLine).mockResolvedValue({ stock_code: '600000', period: 'daily', data: [] });
          vi.mocked(api.stockApi.getCapitalFlow).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getCapitalDistribution).mockResolvedValue({
            stock_code: '600000',
            super_large: { inflow: 0, outflow: 0, net: 0 },
            large: { inflow: 0, outflow: 0, net: 0 },
            medium: { inflow: 0, outflow: 0, net: 0 },
            small: { inflow: 0, outflow: 0, net: 0 },
          });
          vi.mocked(api.stockApi.getProfile).mockResolvedValue({
            name: '浦发银行',
            english_name: 'SPD Bank',
            industry: '银行',
            list_date: '1999-11-10',
            total_shares: 29380000000,
            circulating_shares: 29380000000,
            description: '上海浦东发展银行',
            main_business: '商业银行业务',
            registered_capital: 29380000000,
            employees: 50000,
            province: '上海',
            city: '上海',
            website: 'www.spdb.com.cn',
          });
          vi.mocked(api.stockApi.getShareholders).mockResolvedValue({ stock_code: '600000', shareholders: [] });
          vi.mocked(api.stockApi.getNews).mockResolvedValue({ stock_code: '600000', page: 1, page_size: 20, data: [] });
          vi.mocked(api.stockApi.getAnalystRatings).mockResolvedValue({ stock_code: '600000', ratings: [] });
          vi.mocked(api.stockApi.getFinancials).mockResolvedValue({ stock_code: '600000', report_type: 'quarterly', data: [] });
          vi.mocked(api.stockApi.getBalanceSheet).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getCashFlow).mockResolvedValue({ stock_code: '600000', data: [] });
          vi.mocked(api.stockApi.getAIAnalysis).mockResolvedValue(null);
          
          const onClose = vi.fn();
          
          const { container, unmount } = render(
            <StockDetailDrawer stockCode="600000" onClose={onClose} />
          );

          // Wait for initial data load - wait for stock header to appear (not skeleton)
          await waitFor(() => {
            expect(container.querySelector('[data-testid="stock-header"]')).toBeTruthy();
          });

          // Switch to the target tab
          const tabButton = container.querySelector(`[data-testid="tab-${activeTab}"]`);
          if (tabButton) {
            await user.click(tabButton);
          }

          // Clear mock call counts after initial load
          vi.mocked(api.stockApi.getInfo).mockClear();
          vi.mocked(api.stockApi.getQuote).mockClear();

          // Click refresh button - it should be visible now that data is loaded
          const refreshButton = container.querySelector('[data-testid="refresh-button"]');
          expect(refreshButton).toBeTruthy();
          
          if (refreshButton) {
            await user.click(refreshButton);
          }

          // Verify that the API was called again (data reload triggered)
          await waitFor(() => {
            expect(api.stockApi.getInfo).toHaveBeenCalledWith('600000');
            expect(api.stockApi.getQuote).toHaveBeenCalledWith('600000');
          });

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  // Unit tests for specific behaviors
  describe('Unit Tests', () => {
    it('should not render when stockCode is null', () => {
      const onClose = vi.fn();
      
      const { container } = render(
        <StockDetailDrawer stockCode={null} onClose={onClose} />
      );

      expect(container.querySelector('[data-testid="stock-detail-drawer"]')).toBeNull();
    });

    it('should render drawer when stockCode is provided', async () => {
      const onClose = vi.fn();
      
      render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('stock-detail-drawer')).toBeInTheDocument();
      });
    });

    it('should close drawer when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('stock-detail-drawer-backdrop')).toBeInTheDocument();
      });

      // Click on the backdrop (not the drawer content)
      const backdrop = screen.getByTestId('stock-detail-drawer-backdrop');
      await user.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close drawer when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('close-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('close-button'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should default to overview tab on initial render', async () => {
      const onClose = vi.fn();
      
      const { container } = render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        const overviewTab = container.querySelector('[data-testid="tab-overview"]');
        expect(overviewTab?.classList.contains('border-space-black')).toBe(true);
      });
    });

    it('should display all 6 tabs', async () => {
      const onClose = vi.fn();
      
      render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
        expect(screen.getByTestId('tab-capital')).toBeInTheDocument();
        expect(screen.getByTestId('tab-profile')).toBeInTheDocument();
        expect(screen.getByTestId('tab-news')).toBeInTheDocument();
        expect(screen.getByTestId('tab-finance')).toBeInTheDocument();
        expect(screen.getByTestId('tab-ai-analysis')).toBeInTheDocument();
      });
    });

    it('should show error state and retry button when API fails', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      // Make API fail
      vi.mocked(api.stockApi.getInfo).mockRejectedValue(new Error('API Error'));
      vi.mocked(api.stockApi.getQuote).mockRejectedValue(new Error('API Error'));
      
      render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      // Reset mocks to succeed
      vi.mocked(api.stockApi.getInfo).mockResolvedValue(mockStockInfo);
      vi.mocked(api.stockApi.getQuote).mockResolvedValue(mockQuote);

      // Click retry
      await user.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(api.stockApi.getInfo).toHaveBeenCalledTimes(2);
      });
    });

    it('should reset to overview tab when stockCode changes', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      
      const { container, rerender } = render(
        <StockDetailDrawer stockCode="600000" onClose={onClose} />
      );

      await waitFor(() => {
        expect(container.querySelector('[data-testid="tab-menu"]')).toBeTruthy();
      });

      // Switch to capital tab
      const capitalTab = container.querySelector('[data-testid="tab-capital"]');
      if (capitalTab) {
        await user.click(capitalTab);
      }

      // Verify capital tab is active
      expect(capitalTab?.classList.contains('border-space-black')).toBe(true);

      // Change stock code
      rerender(
        <StockDetailDrawer stockCode="000001" onClose={onClose} />
      );

      // Wait for re-render and verify overview is active again
      await waitFor(() => {
        const overviewTab = container.querySelector('[data-testid="tab-overview"]');
        expect(overviewTab?.classList.contains('border-space-black')).toBe(true);
      });
    });
  });
});
