import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { StockHeader, getPriceColorClass } from './StockHeader';
import type { StockBasicInfo, StockRealtimeQuote } from '../../services/api';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Arbitrary generators for property-based testing
const stockBasicInfoArbitrary = fc.record({
  code: fc.stringMatching(/^[036]\d{5}$/),
  name: fc.string({ minLength: 2, maxLength: 10 }),
  market: fc.constantFrom('SH' as const, 'SZ' as const),
  industry: fc.string({ minLength: 2, maxLength: 20 }),
  list_date: fc.constantFrom('1990-01-01', '1999-11-10', '2000-05-15', '2010-08-20', '2020-03-10'),
});

const stockRealtimeQuoteArbitrary = fc.record({
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  change: fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }),
  change_pct: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
  open: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  high: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  low: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  prev_close: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  volume: fc.integer({ min: 0, max: 1000000000 }),
  amount: fc.integer({ min: 0, max: 100000000000 }),
  turnover_rate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  pe: fc.float({ min: Math.fround(-1000), max: Math.fround(10000), noNaN: true }),
  pb: fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }),
  market_cap: fc.integer({ min: 0, max: 10000000000000 }),
  updated_at: fc.constantFrom(
    '2024-01-15T10:30:00.000Z',
    '2024-06-20T14:45:00.000Z',
    '2024-12-28T09:00:00.000Z'
  ),
});

describe('StockHeader', () => {
  /**
   * Property 1: Stock header rendering completeness
   * Feature: stock-detail-page, Property 1: Stock header rendering completeness
   * Validates: Requirements 1.1, 1.3, 1.4
   * 
   * For any valid StockBasicInfo and StockRealtimeQuote, the rendered StockHeader
   * component should contain stock code, stock name, market identifier, current price,
   * change amount, change percentage, and all key metrics.
   */
  it('Property 1: Stock header rendering completeness - should render all required fields for any valid stock data', () => {
    fc.assert(
      fc.property(
        stockBasicInfoArbitrary,
        stockRealtimeQuoteArbitrary,
        (stockInfo: StockBasicInfo, quote: StockRealtimeQuote) => {
          // Clean up before each iteration
          cleanup();
          
          const onRefresh = vi.fn();
          
          const { container, unmount } = render(
            <StockHeader
              stockInfo={stockInfo}
              quote={quote}
              onRefresh={onRefresh}
              loading={false}
            />
          );

          // Use container queries to avoid global DOM issues
          const header = container.querySelector('[data-testid="stock-header"]');
          expect(header).toBeTruthy();

          // Verify stock basic info is rendered
          const stockName = container.querySelector('[data-testid="stock-name"]');
          const stockCode = container.querySelector('[data-testid="stock-code"]');
          const stockMarket = container.querySelector('[data-testid="stock-market"]');
          
          expect(stockName).toBeTruthy();
          expect(stockName?.textContent).toContain(stockInfo.name);
          expect(stockCode).toBeTruthy();
          expect(stockCode?.textContent).toContain(stockInfo.code);
          expect(stockMarket).toBeTruthy();
          
          // Verify market identifier shows correct text
          const marketText = stockInfo.market === 'SH' ? '上海' : '深圳';
          expect(stockMarket?.textContent).toContain(marketText);

          // Verify price information is rendered
          expect(container.querySelector('[data-testid="current-price"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="price-change"]')).toBeTruthy();

          // Verify all key metrics are rendered
          expect(container.querySelector('[data-testid="metric-open"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-high"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-low"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-prev-close"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-volume"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-amount"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-turnover"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-pe"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-pb"]')).toBeTruthy();
          expect(container.querySelector('[data-testid="metric-market-cap"]')).toBeTruthy();

          // Verify refresh button is present
          expect(container.querySelector('[data-testid="refresh-button"]')).toBeTruthy();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Price color coding consistency
   * Feature: stock-detail-page, Property 2: Price color coding consistency
   * Validates: Requirements 1.2
   * 
   * For any StockRealtimeQuote, if change_pct >= 0, the price display should use
   * the "up" color class (profit-green), otherwise it should use the "down" color
   * class (loss-red).
   */
  it('Property 2: Price color coding consistency - should apply correct color class based on change percentage', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
        (changePct: number) => {
          const colorClass = getPriceColorClass(changePct);
          
          if (changePct >= 0) {
            expect(colorClass).toBe('text-profit-green');
          } else {
            expect(colorClass).toBe('text-loss-red');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (continued): Verify color class is applied to rendered component
   */
  it('Property 2: Price color coding in rendered component - should render price with correct color class', () => {
    fc.assert(
      fc.property(
        stockBasicInfoArbitrary,
        stockRealtimeQuoteArbitrary,
        (stockInfo: StockBasicInfo, quote: StockRealtimeQuote) => {
          // Clean up before each iteration
          cleanup();
          
          const onRefresh = vi.fn();
          
          const { container, unmount } = render(
            <StockHeader
              stockInfo={stockInfo}
              quote={quote}
              onRefresh={onRefresh}
              loading={false}
            />
          );

          const priceElement = container.querySelector('[data-testid="current-price"]');
          const changeElement = container.querySelector('[data-testid="price-change"]');
          
          const expectedColorClass = quote.change_pct >= 0 ? 'text-profit-green' : 'text-loss-red';
          
          expect(priceElement?.classList.contains(expectedColorClass)).toBe(true);
          expect(changeElement?.classList.contains(expectedColorClass)).toBe(true);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for edge cases and specific examples
  describe('Unit Tests', () => {
    it('should show loading skeleton when loading with no data', () => {
      const onRefresh = vi.fn();
      
      render(
        <StockHeader
          stockInfo={null}
          quote={null}
          onRefresh={onRefresh}
          loading={true}
        />
      );

      expect(screen.getByTestId('stock-header-skeleton')).toBeInTheDocument();
    });

    it('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();
      
      const stockInfo: StockBasicInfo = {
        code: '600000',
        name: '浦发银行',
        market: 'SH',
        industry: '银行',
        list_date: '1999-11-10',
      };

      const quote: StockRealtimeQuote = {
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

      render(
        <StockHeader
          stockInfo={stockInfo}
          quote={quote}
          onRefresh={onRefresh}
          loading={false}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      await user.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('should disable refresh button when loading', () => {
      const onRefresh = vi.fn();
      
      const stockInfo: StockBasicInfo = {
        code: '000001',
        name: '平安银行',
        market: 'SZ',
        industry: '银行',
        list_date: '1991-04-03',
      };

      const quote: StockRealtimeQuote = {
        price: 12.0,
        change: -0.3,
        change_pct: -2.44,
        open: 12.3,
        high: 12.4,
        low: 11.9,
        prev_close: 12.3,
        volume: 80000000,
        amount: 9600000000,
        turnover_rate: 2.1,
        pe: 6.0,
        pb: 0.6,
        market_cap: 230000000000,
        updated_at: new Date().toISOString(),
      };

      render(
        <StockHeader
          stockInfo={stockInfo}
          quote={quote}
          onRefresh={onRefresh}
          loading={true}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeDisabled();
    });

    it('should display negative change with correct formatting', () => {
      const onRefresh = vi.fn();
      
      const stockInfo: StockBasicInfo = {
        code: '000002',
        name: '万科A',
        market: 'SZ',
        industry: '房地产',
        list_date: '1991-01-29',
      };

      const quote: StockRealtimeQuote = {
        price: 8.5,
        change: -0.5,
        change_pct: -5.56,
        open: 9.0,
        high: 9.1,
        low: 8.4,
        prev_close: 9.0,
        volume: 100000000,
        amount: 8700000000,
        turnover_rate: 3.2,
        pe: 8.0,
        pb: 0.8,
        market_cap: 100000000000,
        updated_at: new Date().toISOString(),
      };

      render(
        <StockHeader
          stockInfo={stockInfo}
          quote={quote}
          onRefresh={onRefresh}
          loading={false}
        />
      );

      const priceElement = screen.getByTestId('current-price');
      const changeElement = screen.getByTestId('price-change');

      expect(priceElement).toHaveClass('text-loss-red');
      expect(changeElement).toHaveClass('text-loss-red');
      expect(changeElement).toHaveTextContent('-0.50');
      expect(changeElement).toHaveTextContent('-5.56%');
    });
  });
});
