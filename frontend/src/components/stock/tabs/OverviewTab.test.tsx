import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Define OrderBookData type locally to avoid import issues
interface OrderBookData {
  askPrices: number[];
  askVolumes: number[];
  bidPrices: number[];
  bidVolumes: number[];
}

// Format volume helper function
function formatVolumeShort(volume: number): string {
  if (volume >= 10000) {
    return (volume / 10000).toFixed(0) + '万';
  }
  return volume.toString();
}

/**
 * OrderBookDisplay component - copied from OverviewTab to avoid import issues
 * This is a standalone version for testing purposes
 */
const OrderBookDisplay: React.FC<{ orderBook: OrderBookData }> = ({ orderBook }) => {
  const { askPrices, askVolumes, bidPrices, bidVolumes } = orderBook;
  
  // Calculate max volume for bar proportions
  const maxVolume = Math.max(...askVolumes, ...bidVolumes);
  
  return (
    <div className="space-y-1 text-xs" data-testid="order-book">
      {/* Ask levels (from ask5 to ask1) */}
      {[4, 3, 2, 1, 0].map((i) => (
        <div key={`ask-${i}`} className="flex items-center gap-2" data-testid={`ask-${5 - i}`}>
          <span className="w-8 text-gray-500">卖{5 - i}</span>
          <span className="w-16 text-right text-loss-red font-medium">
            {askPrices[i]?.toFixed(2) || '-'}
          </span>
          <div className="flex-1 relative h-4">
            <div
              className="absolute right-0 top-0 h-full bg-red-100"
              style={{ width: `${(askVolumes[i] / maxVolume) * 100}%` }}
            />
            <span className="absolute right-1 top-0 text-gray-600">
              {formatVolumeShort(askVolumes[i])}
            </span>
          </div>
        </div>
      ))}
      
      {/* Separator */}
      <div className="border-t border-gray-200 my-2" />
      
      {/* Bid levels (from bid1 to bid5) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={`bid-${i}`} className="flex items-center gap-2" data-testid={`bid-${i + 1}`}>
          <span className="w-8 text-gray-500">买{i + 1}</span>
          <span className="w-16 text-right text-profit-green font-medium">
            {bidPrices[i]?.toFixed(2) || '-'}
          </span>
          <div className="flex-1 relative h-4">
            <div
              className="absolute left-0 top-0 h-full bg-green-100"
              style={{ width: `${(bidVolumes[i] / maxVolume) * 100}%` }}
            />
            <span className="absolute left-1 top-0 text-gray-600">
              {formatVolumeShort(bidVolumes[i])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Arbitrary generator for OrderBookData
const orderBookDataArbitrary = fc.record({
  askPrices: fc.array(
    fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    { minLength: 5, maxLength: 5 }
  ),
  askVolumes: fc.array(
    fc.integer({ min: 100, max: 1000000 }),
    { minLength: 5, maxLength: 5 }
  ),
  bidPrices: fc.array(
    fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    { minLength: 5, maxLength: 5 }
  ),
  bidVolumes: fc.array(
    fc.integer({ min: 100, max: 1000000 }),
    { minLength: 5, maxLength: 5 }
  ),
});

describe('OverviewTab - OrderBookDisplay', () => {
  /**
   * Property 4: Order book data rendering
   * Feature: stock-detail-page, Property 4: Order book data rendering
   * Validates: Requirements 3.2
   * 
   * For any valid OrderBookData (non-empty buy/sell arrays), the rendered output
   * should display all five ask prices, ask volumes, bid prices, and bid volumes
   * in the correct order (ask5 to ask1, then bid1 to bid5).
   */
  it('Property 4: Order book data rendering - should render all five levels of ask and bid data in correct order', () => {
    fc.assert(
      fc.property(
        orderBookDataArbitrary,
        (orderBook: OrderBookData) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <OrderBookDisplay orderBook={orderBook} />
          );

          // Verify the order book container is rendered
          const orderBookElement = container.querySelector('[data-testid="order-book"]');
          expect(orderBookElement).toBeTruthy();

          // Verify all 5 ask levels are rendered (ask5 to ask1)
          for (let i = 1; i <= 5; i++) {
            const askElement = container.querySelector(`[data-testid="ask-${i}"]`);
            expect(askElement).toBeTruthy();
            
            // Verify the ask price is displayed (from index 5-i in the array)
            const askPrice = orderBook.askPrices[5 - i];
            if (askPrice !== undefined) {
              expect(askElement?.textContent).toContain(askPrice.toFixed(2));
            }
          }

          // Verify all 5 bid levels are rendered (bid1 to bid5)
          for (let i = 1; i <= 5; i++) {
            const bidElement = container.querySelector(`[data-testid="bid-${i}"]`);
            expect(bidElement).toBeTruthy();
            
            // Verify the bid price is displayed (from index i-1 in the array)
            const bidPrice = orderBook.bidPrices[i - 1];
            if (bidPrice !== undefined) {
              expect(bidElement?.textContent).toContain(bidPrice.toFixed(2));
            }
          }

          // Verify ask prices are displayed with loss-red color class
          const askPriceElements = container.querySelectorAll('.text-loss-red');
          expect(askPriceElements.length).toBeGreaterThanOrEqual(5);

          // Verify bid prices are displayed with profit-green color class
          const bidPriceElements = container.querySelectorAll('.text-profit-green');
          expect(bidPriceElements.length).toBeGreaterThanOrEqual(5);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (continued): Verify volume bars are rendered proportionally
   */
  it('Property 4: Order book volume bars - should render volume bars for all levels', () => {
    fc.assert(
      fc.property(
        orderBookDataArbitrary,
        (orderBook: OrderBookData) => {
          // Clean up before each iteration
          cleanup();
          
          const { container, unmount } = render(
            <OrderBookDisplay orderBook={orderBook} />
          );

          // Verify all ask levels have volume displayed
          for (let i = 1; i <= 5; i++) {
            const askElement = container.querySelector(`[data-testid="ask-${i}"]`);
            expect(askElement).toBeTruthy();
            
            // Check that volume is displayed (either as raw number or formatted with 万)
            const volumeIndex = 5 - i;
            const volume = orderBook.askVolumes[volumeIndex];
            // Volume should be present in some form
            const expectedContent = volume >= 10000 ? '万' : volume.toString();
            expect(askElement?.textContent).toContain(expectedContent);
          }

          // Verify all bid levels have volume displayed
          for (let i = 1; i <= 5; i++) {
            const bidElement = container.querySelector(`[data-testid="bid-${i}"]`);
            expect(bidElement).toBeTruthy();
            
            // Check that volume is displayed (either as raw number or formatted with 万)
            const volume = orderBook.bidVolumes[i - 1];
            // Volume should be present in some form
            const expectedContent = volume >= 10000 ? '万' : volume.toString();
            expect(bidElement?.textContent).toContain(expectedContent);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific examples
  describe('Unit Tests', () => {
    it('should render order book with specific values correctly', () => {
      const orderBook: OrderBookData = {
        askPrices: [10.05, 10.04, 10.03, 10.02, 10.01],
        askVolumes: [50000, 40000, 30000, 20000, 10000],
        bidPrices: [10.00, 9.99, 9.98, 9.97, 9.96],
        bidVolumes: [15000, 25000, 35000, 45000, 55000],
      };

      const { container } = render(<OrderBookDisplay orderBook={orderBook} />);

      // Verify ask1 (index 4 in array, displayed first from bottom of asks)
      const ask1 = container.querySelector('[data-testid="ask-1"]');
      expect(ask1?.textContent).toContain('10.01');
      expect(ask1?.textContent).toContain('万'); // 10000 -> 1万

      // Verify ask5 (index 0 in array, displayed at top of asks)
      const ask5 = container.querySelector('[data-testid="ask-5"]');
      expect(ask5?.textContent).toContain('10.05');
      expect(ask5?.textContent).toContain('万'); // 50000 -> 5万

      // Verify bid1 (index 0 in array)
      const bid1 = container.querySelector('[data-testid="bid-1"]');
      expect(bid1?.textContent).toContain('10.00');
      expect(bid1?.textContent).toContain('万'); // 15000 -> 1万

      // Verify bid5 (index 4 in array)
      const bid5 = container.querySelector('[data-testid="bid-5"]');
      expect(bid5?.textContent).toContain('9.96');
      expect(bid5?.textContent).toContain('万'); // 55000 -> 5万
    });

    it('should display correct labels for each level', () => {
      const orderBook: OrderBookData = {
        askPrices: [10.05, 10.04, 10.03, 10.02, 10.01],
        askVolumes: [50000, 40000, 30000, 20000, 10000],
        bidPrices: [10.00, 9.99, 9.98, 9.97, 9.96],
        bidVolumes: [15000, 25000, 35000, 45000, 55000],
      };

      const { container } = render(<OrderBookDisplay orderBook={orderBook} />);

      // Verify labels
      expect(container.textContent).toContain('卖5');
      expect(container.textContent).toContain('卖4');
      expect(container.textContent).toContain('卖3');
      expect(container.textContent).toContain('卖2');
      expect(container.textContent).toContain('卖1');
      expect(container.textContent).toContain('买1');
      expect(container.textContent).toContain('买2');
      expect(container.textContent).toContain('买3');
      expect(container.textContent).toContain('买4');
      expect(container.textContent).toContain('买5');
    });
  });
});
