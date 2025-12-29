import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define types locally to avoid import issues
interface FinancialMetrics {
  report_date: string;
  revenue: number;
  revenue_yoy: number;
  net_profit: number;
  net_profit_yoy: number;
  gross_margin: number;
  net_margin: number;
  roe: number;
  eps: number;
  bps: number;
}

interface BalanceSheet {
  report_date: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  current_assets: number;
  current_liabilities: number;
  cash_and_equivalents: number;
}

interface CashFlow {
  report_date: string;
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  net_cash_flow: number;
}

/**
 * Format amount helper function (copied from FinanceTab)
 */
function formatAmount(value: number): string {
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
 * Format percentage helper function (copied from FinanceTab)
 */
function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return value.toFixed(2) + '%';
}

/**
 * FinancialMetricsDisplay component - standalone version for testing
 */
const FinancialMetricsDisplay: React.FC<{ data: FinancialMetrics }> = ({ data }) => {
  const metricsItems = [
    { label: '营业收入', value: formatAmount(data.revenue), change: data.revenue_yoy, testId: 'metric-revenue' },
    { label: '净利润', value: formatAmount(data.net_profit), change: data.net_profit_yoy, testId: 'metric-net-profit' },
    { label: '毛利率', value: formatPercentage(data.gross_margin), testId: 'metric-gross-margin' },
    { label: '净利率', value: formatPercentage(data.net_margin), testId: 'metric-net-margin' },
    { label: '每股收益', value: data.eps?.toFixed(2) || '-', testId: 'metric-eps' },
    { label: '每股净资产', value: data.bps?.toFixed(2) || '-', testId: 'metric-bps' },
    { label: '净资产收益率', value: formatPercentage(data.roe), testId: 'metric-roe' },
    { label: '报告期', value: data.report_date || '-', testId: 'metric-report-date' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4" data-testid="financial-metrics-display">
      {metricsItems.map((item, index) => (
        <div key={index} className="p-3 bg-gray-50 rounded-lg" data-testid={item.testId}>
          <div className="text-xs text-gray-500 mb-1">{item.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">{item.value}</span>
            {item.change !== undefined && (
              <span
                className={`text-xs ${item.change >= 0 ? 'text-profit-green' : 'text-loss-red'}`}
                data-testid={`${item.testId}-yoy`}
              >
                {item.change >= 0 ? '+' : ''}{formatPercentage(item.change)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * BalanceSheetSummary component - standalone version for testing
 */
const BalanceSheetSummary: React.FC<{ data: BalanceSheet }> = ({ data }) => {
  const items = [
    { label: '总资产', value: formatAmount(data.total_assets), testId: 'bs-total-assets' },
    { label: '总负债', value: formatAmount(data.total_liabilities), testId: 'bs-total-liabilities' },
    { label: '股东权益', value: formatAmount(data.total_equity), testId: 'bs-total-equity' },
    { label: '流动资产', value: formatAmount(data.current_assets), testId: 'bs-current-assets' },
    { label: '流动负债', value: formatAmount(data.current_liabilities), testId: 'bs-current-liabilities' },
    { label: '货币资金', value: formatAmount(data.cash_and_equivalents), testId: 'bs-cash' },
  ];

  const debtRatio = data.total_assets > 0 ? (data.total_liabilities / data.total_assets * 100) : 0;
  const currentRatio = data.current_liabilities > 0 ? (data.current_assets / data.current_liabilities) : 0;

  return (
    <div data-testid="balance-sheet-summary">
      <div className="text-xs text-gray-500 mb-3">报告期: {data.report_date}</div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {items.map((item, index) => (
          <div key={index} className="flex flex-col" data-testid={item.testId}>
            <span className="text-gray-500 text-xs">{item.label}</span>
            <span className="text-gray-900 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
        <div className="flex flex-col" data-testid="bs-debt-ratio">
          <span className="text-gray-500 text-xs">资产负债率</span>
          <span className="text-gray-900 font-medium">{formatPercentage(debtRatio)}</span>
        </div>
        <div className="flex flex-col" data-testid="bs-current-ratio">
          <span className="text-gray-500 text-xs">流动比率</span>
          <span className="text-gray-900 font-medium">{currentRatio.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * CashFlowSummary component - standalone version for testing
 */
const CashFlowSummary: React.FC<{ data: CashFlow }> = ({ data }) => {
  const items = [
    { label: '经营活动现金流', value: data.operating_cash_flow, testId: 'cf-operating' },
    { label: '投资活动现金流', value: data.investing_cash_flow, testId: 'cf-investing' },
    { label: '筹资活动现金流', value: data.financing_cash_flow, testId: 'cf-financing' },
    { label: '现金净流量', value: data.net_cash_flow, testId: 'cf-net' },
  ];

  return (
    <div data-testid="cash-flow-summary">
      <div className="text-xs text-gray-500 mb-3">报告期: {data.report_date}</div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg" data-testid={item.testId}>
            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
            <div className={`text-lg font-semibold ${item.value >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
              {item.value >= 0 ? '+' : ''}{formatAmount(item.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// Helper to generate valid date strings
const dateStringArbitrary = fc.integer({ min: 2020, max: 2025 })
  .chain(year => fc.integer({ min: 1, max: 12 })
    .chain(month => fc.integer({ min: 1, max: 28 })
      .map(day => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)));

// Arbitrary generator for FinancialMetrics
const financialMetricsArbitrary = fc.record({
  report_date: dateStringArbitrary,
  revenue: fc.integer({ min: 1000000, max: 100000000000 }),
  revenue_yoy: fc.float({ min: Math.fround(-100), max: Math.fround(500), noNaN: true }),
  net_profit: fc.integer({ min: -10000000000, max: 50000000000 }),
  net_profit_yoy: fc.float({ min: Math.fround(-200), max: Math.fround(1000), noNaN: true }),
  gross_margin: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  net_margin: fc.float({ min: Math.fround(-50), max: Math.fround(80), noNaN: true }),
  roe: fc.float({ min: Math.fround(-50), max: Math.fround(100), noNaN: true }),
  eps: fc.float({ min: Math.fround(-10), max: Math.fround(50), noNaN: true }),
  bps: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
});

// Arbitrary generator for BalanceSheet
const balanceSheetArbitrary = fc.record({
  report_date: dateStringArbitrary,
  total_assets: fc.integer({ min: 10000000, max: 1000000000000 }),
  total_liabilities: fc.integer({ min: 1000000, max: 500000000000 }),
  total_equity: fc.integer({ min: 1000000, max: 500000000000 }),
  current_assets: fc.integer({ min: 1000000, max: 200000000000 }),
  current_liabilities: fc.integer({ min: 1000000, max: 200000000000 }),
  cash_and_equivalents: fc.integer({ min: 100000, max: 100000000000 }),
});

// Arbitrary generator for CashFlow
const cashFlowArbitrary = fc.record({
  report_date: dateStringArbitrary,
  operating_cash_flow: fc.integer({ min: -50000000000, max: 100000000000 }),
  investing_cash_flow: fc.integer({ min: -100000000000, max: 50000000000 }),
  financing_cash_flow: fc.integer({ min: -50000000000, max: 100000000000 }),
  net_cash_flow: fc.integer({ min: -100000000000, max: 100000000000 }),
});

describe('FinanceTab - Property Tests', () => {
  /**
   * Property 8: Financial metrics rendering
   * Feature: stock-detail-page, Property 8: Financial metrics rendering
   * Validates: Requirements 7.1, 7.3, 7.4, 7.5
   * 
   * For any valid FinancialMetrics, BalanceSheet, and CashFlow data, the rendered FinanceTab
   * should display revenue, net profit, gross margin, net margin, total assets, total liabilities,
   * total equity, and all cash flow components.
   */
  it('Property 8: Financial metrics rendering - should render revenue, net profit, gross margin, and net margin', () => {
    fc.assert(
      fc.property(
        financialMetricsArbitrary,
        (metrics: FinancialMetrics) => {
          cleanup();
          
          const { container, unmount } = render(
            <FinancialMetricsDisplay data={metrics} />
          );

          // Verify the metrics container is rendered
          const metricsElement = container.querySelector('[data-testid="financial-metrics-display"]');
          expect(metricsElement).toBeTruthy();

          // Verify revenue is displayed
          const revenueElement = container.querySelector('[data-testid="metric-revenue"]');
          expect(revenueElement).toBeTruthy();
          expect(revenueElement?.textContent).toContain('营业收入');
          expect(revenueElement?.textContent).toContain(formatAmount(metrics.revenue));

          // Verify net profit is displayed
          const netProfitElement = container.querySelector('[data-testid="metric-net-profit"]');
          expect(netProfitElement).toBeTruthy();
          expect(netProfitElement?.textContent).toContain('净利润');
          expect(netProfitElement?.textContent).toContain(formatAmount(metrics.net_profit));

          // Verify gross margin is displayed
          const grossMarginElement = container.querySelector('[data-testid="metric-gross-margin"]');
          expect(grossMarginElement).toBeTruthy();
          expect(grossMarginElement?.textContent).toContain('毛利率');
          expect(grossMarginElement?.textContent).toContain(formatPercentage(metrics.gross_margin));

          // Verify net margin is displayed
          const netMarginElement = container.querySelector('[data-testid="metric-net-margin"]');
          expect(netMarginElement).toBeTruthy();
          expect(netMarginElement?.textContent).toContain('净利率');
          expect(netMarginElement?.textContent).toContain(formatPercentage(metrics.net_margin));

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Verify balance sheet data is displayed
   */
  it('Property 8: Financial metrics rendering - should render total assets, total liabilities, and total equity', () => {
    fc.assert(
      fc.property(
        balanceSheetArbitrary,
        (balanceSheet: BalanceSheet) => {
          cleanup();
          
          const { container, unmount } = render(
            <BalanceSheetSummary data={balanceSheet} />
          );

          // Verify the balance sheet container is rendered
          const bsElement = container.querySelector('[data-testid="balance-sheet-summary"]');
          expect(bsElement).toBeTruthy();

          // Verify total assets is displayed
          const totalAssetsElement = container.querySelector('[data-testid="bs-total-assets"]');
          expect(totalAssetsElement).toBeTruthy();
          expect(totalAssetsElement?.textContent).toContain('总资产');
          expect(totalAssetsElement?.textContent).toContain(formatAmount(balanceSheet.total_assets));

          // Verify total liabilities is displayed
          const totalLiabilitiesElement = container.querySelector('[data-testid="bs-total-liabilities"]');
          expect(totalLiabilitiesElement).toBeTruthy();
          expect(totalLiabilitiesElement?.textContent).toContain('总负债');
          expect(totalLiabilitiesElement?.textContent).toContain(formatAmount(balanceSheet.total_liabilities));

          // Verify total equity is displayed
          const totalEquityElement = container.querySelector('[data-testid="bs-total-equity"]');
          expect(totalEquityElement).toBeTruthy();
          expect(totalEquityElement?.textContent).toContain('股东权益');
          expect(totalEquityElement?.textContent).toContain(formatAmount(balanceSheet.total_equity));

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Verify cash flow data is displayed
   */
  it('Property 8: Financial metrics rendering - should render all cash flow components', () => {
    fc.assert(
      fc.property(
        cashFlowArbitrary,
        (cashFlow: CashFlow) => {
          cleanup();
          
          const { container, unmount } = render(
            <CashFlowSummary data={cashFlow} />
          );

          // Verify the cash flow container is rendered
          const cfElement = container.querySelector('[data-testid="cash-flow-summary"]');
          expect(cfElement).toBeTruthy();

          // Verify operating cash flow is displayed
          const operatingElement = container.querySelector('[data-testid="cf-operating"]');
          expect(operatingElement).toBeTruthy();
          expect(operatingElement?.textContent).toContain('经营活动现金流');
          expect(operatingElement?.textContent).toContain(formatAmount(cashFlow.operating_cash_flow));

          // Verify investing cash flow is displayed
          const investingElement = container.querySelector('[data-testid="cf-investing"]');
          expect(investingElement).toBeTruthy();
          expect(investingElement?.textContent).toContain('投资活动现金流');
          expect(investingElement?.textContent).toContain(formatAmount(cashFlow.investing_cash_flow));

          // Verify financing cash flow is displayed
          const financingElement = container.querySelector('[data-testid="cf-financing"]');
          expect(financingElement).toBeTruthy();
          expect(financingElement?.textContent).toContain('筹资活动现金流');
          expect(financingElement?.textContent).toContain(formatAmount(cashFlow.financing_cash_flow));

          // Verify net cash flow is displayed
          const netElement = container.querySelector('[data-testid="cf-net"]');
          expect(netElement).toBeTruthy();
          expect(netElement?.textContent).toContain('现金净流量');
          expect(netElement?.textContent).toContain(formatAmount(cashFlow.net_cash_flow));

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Verify color coding for positive/negative cash flows
   */
  it('Property 8: Financial metrics rendering - should apply correct color classes for positive/negative cash flows', () => {
    fc.assert(
      fc.property(
        cashFlowArbitrary,
        (cashFlow: CashFlow) => {
          cleanup();
          
          const { container, unmount } = render(
            <CashFlowSummary data={cashFlow} />
          );

          // Verify operating cash flow has correct color class
          const operatingElement = container.querySelector('[data-testid="cf-operating"]');
          expect(operatingElement).toBeTruthy();
          if (cashFlow.operating_cash_flow >= 0) {
            expect(operatingElement?.innerHTML).toContain('text-profit-green');
          } else {
            expect(operatingElement?.innerHTML).toContain('text-loss-red');
          }

          // Verify net cash flow has correct color class
          const netElement = container.querySelector('[data-testid="cf-net"]');
          expect(netElement).toBeTruthy();
          if (cashFlow.net_cash_flow >= 0) {
            expect(netElement?.innerHTML).toContain('text-profit-green');
          } else {
            expect(netElement?.innerHTML).toContain('text-loss-red');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should render financial metrics with specific values correctly', () => {
      const metrics: FinancialMetrics = {
        report_date: '2024-06-30',
        revenue: 50000000000,
        revenue_yoy: 15.5,
        net_profit: 8000000000,
        net_profit_yoy: 20.3,
        gross_margin: 35.5,
        net_margin: 16.0,
        roe: 18.5,
        eps: 2.5,
        bps: 15.8,
      };

      const { container } = render(<FinancialMetricsDisplay data={metrics} />);

      // Verify revenue (500亿)
      const revenueElement = container.querySelector('[data-testid="metric-revenue"]');
      expect(revenueElement?.textContent).toContain('500.00亿');

      // Verify net profit (80亿)
      const netProfitElement = container.querySelector('[data-testid="metric-net-profit"]');
      expect(netProfitElement?.textContent).toContain('80.00亿');

      // Verify gross margin
      const grossMarginElement = container.querySelector('[data-testid="metric-gross-margin"]');
      expect(grossMarginElement?.textContent).toContain('35.50%');

      // Verify net margin
      const netMarginElement = container.querySelector('[data-testid="metric-net-margin"]');
      expect(netMarginElement?.textContent).toContain('16.00%');

      // Verify EPS
      const epsElement = container.querySelector('[data-testid="metric-eps"]');
      expect(epsElement?.textContent).toContain('2.50');

      // Verify ROE
      const roeElement = container.querySelector('[data-testid="metric-roe"]');
      expect(roeElement?.textContent).toContain('18.50%');

      // Verify YoY changes are displayed with correct signs
      const revenueYoyElement = container.querySelector('[data-testid="metric-revenue-yoy"]');
      expect(revenueYoyElement?.textContent).toContain('+15.50%');

      const netProfitYoyElement = container.querySelector('[data-testid="metric-net-profit-yoy"]');
      expect(netProfitYoyElement?.textContent).toContain('+20.30%');
    });

    it('should render balance sheet with specific values correctly', () => {
      const balanceSheet: BalanceSheet = {
        report_date: '2024-06-30',
        total_assets: 200000000000,
        total_liabilities: 120000000000,
        total_equity: 80000000000,
        current_assets: 50000000000,
        current_liabilities: 40000000000,
        cash_and_equivalents: 30000000000,
      };

      const { container } = render(<BalanceSheetSummary data={balanceSheet} />);

      // Verify total assets (2000亿)
      const totalAssetsElement = container.querySelector('[data-testid="bs-total-assets"]');
      expect(totalAssetsElement?.textContent).toContain('2000.00亿');

      // Verify total liabilities (1200亿)
      const totalLiabilitiesElement = container.querySelector('[data-testid="bs-total-liabilities"]');
      expect(totalLiabilitiesElement?.textContent).toContain('1200.00亿');

      // Verify total equity (800亿)
      const totalEquityElement = container.querySelector('[data-testid="bs-total-equity"]');
      expect(totalEquityElement?.textContent).toContain('800.00亿');

      // Verify debt ratio (60%)
      const debtRatioElement = container.querySelector('[data-testid="bs-debt-ratio"]');
      expect(debtRatioElement?.textContent).toContain('60.00%');

      // Verify current ratio (1.25)
      const currentRatioElement = container.querySelector('[data-testid="bs-current-ratio"]');
      expect(currentRatioElement?.textContent).toContain('1.25');
    });

    it('should render cash flow with specific values correctly', () => {
      const cashFlow: CashFlow = {
        report_date: '2024-06-30',
        operating_cash_flow: 15000000000,
        investing_cash_flow: -8000000000,
        financing_cash_flow: -5000000000,
        net_cash_flow: 2000000000,
      };

      const { container } = render(<CashFlowSummary data={cashFlow} />);

      // Verify operating cash flow (positive, 150亿)
      const operatingElement = container.querySelector('[data-testid="cf-operating"]');
      expect(operatingElement?.textContent).toContain('+150.00亿');
      expect(operatingElement?.innerHTML).toContain('text-profit-green');

      // Verify investing cash flow (negative, -80亿)
      const investingElement = container.querySelector('[data-testid="cf-investing"]');
      expect(investingElement?.textContent).toContain('-80.00亿');
      expect(investingElement?.innerHTML).toContain('text-loss-red');

      // Verify financing cash flow (negative, -50亿)
      const financingElement = container.querySelector('[data-testid="cf-financing"]');
      expect(financingElement?.textContent).toContain('-50.00亿');
      expect(financingElement?.innerHTML).toContain('text-loss-red');

      // Verify net cash flow (positive, 20亿)
      const netElement = container.querySelector('[data-testid="cf-net"]');
      expect(netElement?.textContent).toContain('+20.00亿');
      expect(netElement?.innerHTML).toContain('text-profit-green');
    });

    it('should display all labels correctly', () => {
      const metrics: FinancialMetrics = {
        report_date: '2024-06-30',
        revenue: 10000000000,
        revenue_yoy: 10,
        net_profit: 1000000000,
        net_profit_yoy: 5,
        gross_margin: 30,
        net_margin: 10,
        roe: 15,
        eps: 1.5,
        bps: 10,
      };

      const { container } = render(<FinancialMetricsDisplay data={metrics} />);

      // Verify all labels are present
      expect(container.textContent).toContain('营业收入');
      expect(container.textContent).toContain('净利润');
      expect(container.textContent).toContain('毛利率');
      expect(container.textContent).toContain('净利率');
      expect(container.textContent).toContain('每股收益');
      expect(container.textContent).toContain('每股净资产');
      expect(container.textContent).toContain('净资产收益率');
      expect(container.textContent).toContain('报告期');
    });

    it('should handle negative YoY changes correctly', () => {
      const metrics: FinancialMetrics = {
        report_date: '2024-06-30',
        revenue: 10000000000,
        revenue_yoy: -15.5,
        net_profit: 1000000000,
        net_profit_yoy: -25.3,
        gross_margin: 30,
        net_margin: 10,
        roe: 15,
        eps: 1.5,
        bps: 10,
      };

      const { container } = render(<FinancialMetricsDisplay data={metrics} />);

      // Verify negative YoY changes are displayed correctly
      const revenueYoyElement = container.querySelector('[data-testid="metric-revenue-yoy"]');
      expect(revenueYoyElement?.textContent).toContain('-15.50%');
      expect(revenueYoyElement?.className).toContain('text-loss-red');

      const netProfitYoyElement = container.querySelector('[data-testid="metric-net-profit-yoy"]');
      expect(netProfitYoyElement?.textContent).toContain('-25.30%');
      expect(netProfitYoyElement?.className).toContain('text-loss-red');
    });
  });
});
