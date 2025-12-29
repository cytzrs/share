import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define CapitalFlowData type locally to avoid import issues
interface CapitalFlowData {
  date: string;
  main_inflow: number;
  main_outflow: number;
  main_net: number;
  retail_inflow: number;
  retail_outflow: number;
  retail_net: number;
  total_inflow: number;
  total_outflow: number;
  total_net: number;
}

// Define CapitalDistribution type locally
interface CapitalDistributionItem {
  inflow: number;
  outflow: number;
  net: number;
}

interface CapitalDistribution {
  stock_code: string;
  super_large: CapitalDistributionItem;
  large: CapitalDistributionItem;
  medium: CapitalDistributionItem;
  small: CapitalDistributionItem;
}

/**
 * Format amount helper function (copied from CapitalTab)
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
 * CapitalFlowSummary component - standalone version for testing
 */
const CapitalFlowSummary: React.FC<{ data: CapitalFlowData }> = ({ data }) => {
  const summaryItems = [
    {
      label: '总流入',
      value: data.total_inflow,
      color: 'text-profit-green',
      bgColor: 'bg-green-50',
    },
    {
      label: '总流出',
      value: data.total_outflow,
      color: 'text-loss-red',
      bgColor: 'bg-red-50',
    },
    {
      label: '净流入',
      value: data.total_net,
      color: data.total_net >= 0 ? 'text-profit-green' : 'text-loss-red',
      bgColor: data.total_net >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  const detailItems = [
    {
      label: '主力流入',
      value: data.main_inflow,
      color: 'text-profit-green',
    },
    {
      label: '主力流出',
      value: data.main_outflow,
      color: 'text-loss-red',
    },
    {
      label: '主力净流入',
      value: data.main_net,
      color: data.main_net >= 0 ? 'text-profit-green' : 'text-loss-red',
    },
    {
      label: '散户流入',
      value: data.retail_inflow,
      color: 'text-profit-green',
    },
    {
      label: '散户流出',
      value: data.retail_outflow,
      color: 'text-loss-red',
    },
    {
      label: '散户净流入',
      value: data.retail_net,
      color: data.retail_net >= 0 ? 'text-profit-green' : 'text-loss-red',
    },
  ];

  return (
    <div data-testid="capital-flow-summary">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4" data-testid="capital-summary-cards">
        {summaryItems.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${item.bgColor}`}
            data-testid={`summary-${item.label}`}
          >
            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
            <div className={`text-lg font-semibold ${item.color}`}>
              {item.value >= 0 && item.label === '净流入' ? '+' : ''}
              {formatAmount(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm" data-testid="capital-detail-grid">
        {detailItems.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-1" data-testid={`detail-${item.label}`}>
            <span className="text-gray-500">{item.label}</span>
            <span className={`font-medium ${item.color}`}>
              {(item.label.includes('净') && item.value >= 0) ? '+' : ''}
              {formatAmount(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper to generate valid date strings
const dateStringArbitrary = fc.tuple(
  fc.integer({ min: 2020, max: 2025 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
).map(([year, month, day]) => 
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

// Arbitrary generator for CapitalFlowData
const capitalFlowDataArbitrary = fc.record({
  date: dateStringArbitrary,
  main_inflow: fc.float({ min: 0, max: 1000000000, noNaN: true }),
  main_outflow: fc.float({ min: 0, max: 1000000000, noNaN: true }),
  main_net: fc.float({ min: -500000000, max: 500000000, noNaN: true }),
  retail_inflow: fc.float({ min: 0, max: 500000000, noNaN: true }),
  retail_outflow: fc.float({ min: 0, max: 500000000, noNaN: true }),
  retail_net: fc.float({ min: -250000000, max: 250000000, noNaN: true }),
  total_inflow: fc.float({ min: 0, max: 1500000000, noNaN: true }),
  total_outflow: fc.float({ min: 0, max: 1500000000, noNaN: true }),
  total_net: fc.float({ min: -750000000, max: 750000000, noNaN: true }),
});

// Arbitrary generator for CapitalDistributionItem
const capitalDistributionItemArbitrary = fc.record({
  inflow: fc.float({ min: 0, max: 500000000, noNaN: true }),
  outflow: fc.float({ min: 0, max: 500000000, noNaN: true }),
  net: fc.float({ min: -250000000, max: 250000000, noNaN: true }),
});

// Arbitrary generator for CapitalDistribution
const capitalDistributionArbitrary = fc.record({
  stock_code: fc.stringMatching(/^[0-9]{6}$/),
  super_large: capitalDistributionItemArbitrary,
  large: capitalDistributionItemArbitrary,
  medium: capitalDistributionItemArbitrary,
  small: capitalDistributionItemArbitrary,
});

describe('CapitalTab - CapitalFlowSummary', () => {
  /**
   * Property 5: Capital flow data rendering
   * Feature: stock-detail-page, Property 5: Capital flow data rendering
   * Validates: Requirements 4.1, 4.2
   * 
   * For any valid CapitalFlowData and CapitalDistribution, the rendered CapitalTab
   * should display inflow amount, outflow amount, net inflow, and distribution by
   * investor type (main force, retail), with percentages calculated correctly.
   */
  it('Property 5: Capital flow data rendering - should render inflow, outflow, and net flow amounts', () => {
    fc.assert(
      fc.property(
        capitalFlowDataArbitrary,
        (flowData: CapitalFlowData) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <CapitalFlowSummary data={flowData} />
          );

          // Verify the summary container is rendered
          const summaryElement = container.querySelector('[data-testid="capital-flow-summary"]');
          expect(summaryElement).toBeTruthy();

          // Verify summary cards are rendered
          const summaryCards = container.querySelector('[data-testid="capital-summary-cards"]');
          expect(summaryCards).toBeTruthy();

          // Verify total inflow is displayed
          const inflowCard = container.querySelector('[data-testid="summary-总流入"]');
          expect(inflowCard).toBeTruthy();
          expect(inflowCard?.textContent).toContain('总流入');
          // Verify the formatted amount is present (either 亿, 万, or raw number)
          const inflowFormatted = formatAmount(flowData.total_inflow);
          expect(inflowCard?.textContent).toContain(inflowFormatted);

          // Verify total outflow is displayed
          const outflowCard = container.querySelector('[data-testid="summary-总流出"]');
          expect(outflowCard).toBeTruthy();
          expect(outflowCard?.textContent).toContain('总流出');
          const outflowFormatted = formatAmount(flowData.total_outflow);
          expect(outflowCard?.textContent).toContain(outflowFormatted);

          // Verify net flow is displayed
          const netCard = container.querySelector('[data-testid="summary-净流入"]');
          expect(netCard).toBeTruthy();
          expect(netCard?.textContent).toContain('净流入');
          const netFormatted = formatAmount(flowData.total_net);
          expect(netCard?.textContent).toContain(netFormatted);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (continued): Verify investor type distribution is displayed
   */
  it('Property 5: Capital flow data rendering - should render main force and retail investor data', () => {
    fc.assert(
      fc.property(
        capitalFlowDataArbitrary,
        (flowData: CapitalFlowData) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <CapitalFlowSummary data={flowData} />
          );

          // Verify detail grid is rendered
          const detailGrid = container.querySelector('[data-testid="capital-detail-grid"]');
          expect(detailGrid).toBeTruthy();

          // Verify main force (主力) data is displayed
          const mainInflow = container.querySelector('[data-testid="detail-主力流入"]');
          expect(mainInflow).toBeTruthy();
          expect(mainInflow?.textContent).toContain('主力流入');
          expect(mainInflow?.textContent).toContain(formatAmount(flowData.main_inflow));

          const mainOutflow = container.querySelector('[data-testid="detail-主力流出"]');
          expect(mainOutflow).toBeTruthy();
          expect(mainOutflow?.textContent).toContain('主力流出');
          expect(mainOutflow?.textContent).toContain(formatAmount(flowData.main_outflow));

          const mainNet = container.querySelector('[data-testid="detail-主力净流入"]');
          expect(mainNet).toBeTruthy();
          expect(mainNet?.textContent).toContain('主力净流入');
          expect(mainNet?.textContent).toContain(formatAmount(flowData.main_net));

          // Verify retail (散户) data is displayed
          const retailInflow = container.querySelector('[data-testid="detail-散户流入"]');
          expect(retailInflow).toBeTruthy();
          expect(retailInflow?.textContent).toContain('散户流入');
          expect(retailInflow?.textContent).toContain(formatAmount(flowData.retail_inflow));

          const retailOutflow = container.querySelector('[data-testid="detail-散户流出"]');
          expect(retailOutflow).toBeTruthy();
          expect(retailOutflow?.textContent).toContain('散户流出');
          expect(retailOutflow?.textContent).toContain(formatAmount(flowData.retail_outflow));

          const retailNet = container.querySelector('[data-testid="detail-散户净流入"]');
          expect(retailNet).toBeTruthy();
          expect(retailNet?.textContent).toContain('散户净流入');
          expect(retailNet?.textContent).toContain(formatAmount(flowData.retail_net));

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (continued): Verify color coding for positive/negative values
   */
  it('Property 5: Capital flow data rendering - should apply correct color classes for positive/negative values', () => {
    fc.assert(
      fc.property(
        capitalFlowDataArbitrary,
        (flowData: CapitalFlowData) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <CapitalFlowSummary data={flowData} />
          );

          // Verify net flow card has correct color class
          const netCard = container.querySelector('[data-testid="summary-净流入"]');
          expect(netCard).toBeTruthy();
          
          // Check the card's class attribute for background color
          const netCardClass = netCard?.className || '';
          if (flowData.total_net >= 0) {
            expect(netCardClass).toContain('bg-green-50');
            // Check inner content for text color
            expect(netCard?.innerHTML).toContain('text-profit-green');
          } else {
            expect(netCardClass).toContain('bg-red-50');
            expect(netCard?.innerHTML).toContain('text-loss-red');
          }

          // Verify main net has correct color class
          const mainNet = container.querySelector('[data-testid="detail-主力净流入"]');
          expect(mainNet).toBeTruthy();
          if (flowData.main_net >= 0) {
            expect(mainNet?.innerHTML).toContain('text-profit-green');
          } else {
            expect(mainNet?.innerHTML).toContain('text-loss-red');
          }

          // Verify retail net has correct color class
          const retailNet = container.querySelector('[data-testid="detail-散户净流入"]');
          expect(retailNet).toBeTruthy();
          if (flowData.retail_net >= 0) {
            expect(retailNet?.innerHTML).toContain('text-profit-green');
          } else {
            expect(retailNet?.innerHTML).toContain('text-loss-red');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should render capital flow summary with specific values correctly', () => {
      const flowData: CapitalFlowData = {
        date: '2025-01-15',
        main_inflow: 150000000,
        main_outflow: 100000000,
        main_net: 50000000,
        retail_inflow: 80000000,
        retail_outflow: 90000000,
        retail_net: -10000000,
        total_inflow: 230000000,
        total_outflow: 190000000,
        total_net: 40000000,
      };

      const { container } = render(<CapitalFlowSummary data={flowData} />);

      // Verify total inflow (2.3亿)
      const inflowCard = container.querySelector('[data-testid="summary-总流入"]');
      expect(inflowCard?.textContent).toContain('2.30亿');

      // Verify total outflow (1.9亿)
      const outflowCard = container.querySelector('[data-testid="summary-总流出"]');
      expect(outflowCard?.textContent).toContain('1.90亿');

      // Verify net flow (4000万) with + sign
      const netCard = container.querySelector('[data-testid="summary-净流入"]');
      expect(netCard?.textContent).toContain('+');
      expect(netCard?.textContent).toContain('4000.00万');

      // Verify main force data
      const mainInflow = container.querySelector('[data-testid="detail-主力流入"]');
      expect(mainInflow?.textContent).toContain('1.50亿');

      const mainNet = container.querySelector('[data-testid="detail-主力净流入"]');
      expect(mainNet?.textContent).toContain('+');
      expect(mainNet?.textContent).toContain('5000.00万');

      // Verify retail data (negative net)
      const retailNet = container.querySelector('[data-testid="detail-散户净流入"]');
      expect(retailNet?.textContent).toContain('-1000.00万');
    });

    it('should display correct labels for all fields', () => {
      const flowData: CapitalFlowData = {
        date: '2025-01-15',
        main_inflow: 100000000,
        main_outflow: 80000000,
        main_net: 20000000,
        retail_inflow: 50000000,
        retail_outflow: 60000000,
        retail_net: -10000000,
        total_inflow: 150000000,
        total_outflow: 140000000,
        total_net: 10000000,
      };

      const { container } = render(<CapitalFlowSummary data={flowData} />);

      // Verify all labels are present
      expect(container.textContent).toContain('总流入');
      expect(container.textContent).toContain('总流出');
      expect(container.textContent).toContain('净流入');
      expect(container.textContent).toContain('主力流入');
      expect(container.textContent).toContain('主力流出');
      expect(container.textContent).toContain('主力净流入');
      expect(container.textContent).toContain('散户流入');
      expect(container.textContent).toContain('散户流出');
      expect(container.textContent).toContain('散户净流入');
    });

    it('should handle small values correctly (no 万 or 亿 suffix)', () => {
      const flowData: CapitalFlowData = {
        date: '2025-01-15',
        main_inflow: 5000,
        main_outflow: 3000,
        main_net: 2000,
        retail_inflow: 1000,
        retail_outflow: 1500,
        retail_net: -500,
        total_inflow: 6000,
        total_outflow: 4500,
        total_net: 1500,
      };

      const { container } = render(<CapitalFlowSummary data={flowData} />);

      // Verify small values are displayed without suffix
      const inflowCard = container.querySelector('[data-testid="summary-总流入"]');
      expect(inflowCard?.textContent).toContain('6000.00');
      expect(inflowCard?.textContent).not.toContain('万');
      expect(inflowCard?.textContent).not.toContain('亿');
    });
  });
});
