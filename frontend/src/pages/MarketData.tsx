import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { GlassCard } from '../components/ui';
import { StockDetailDrawer, StockCodeLink } from '../components/stock';
import { marketApi, quotesApi, type MarketDataResponse, type HotStocksResponse, type StockQuoteListResponse, type StockHistoryResponse } from '../services/api';
import { useToast, useAuth } from '../contexts';

type TabType = 'stock_list' | 'hot_stocks';

const MarketData: React.FC = () => {
  const [data, setData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('stock_list');
  
  // 热门股票
  const [hotStocksData, setHotStocksData] = useState<HotStocksResponse | null>(null);
  const [hotStocksPage, setHotStocksPage] = useState(1);
  const [hotStocksLoading, setHotStocksLoading] = useState(false);
  
  // 股票列表
  const [stockListData, setStockListData] = useState<StockQuoteListResponse | null>(null);
  const [stockListPage, setStockListPage] = useState(1);
  const [stockListLoading, setStockListLoading] = useState(false);
  const [stockListSearch, setStockListSearch] = useState('');
  const [refreshingStock, setRefreshingStock] = useState<string | null>(null);
  
  // 历史数据弹窗
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStockCode, setHistoryStockCode] = useState<string | null>(null);
  const [historyStockName, setHistoryStockName] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<StockHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  
  // 热门股票筛选
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'change_pct' | 'volume' | 'amount'>('change_pct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await marketApi.getAll();
      setData(response);
      await loadHotStocks(1);
      await loadStockList(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);


  const loadHotStocks = useCallback(async (page: number) => {
    try {
      setHotStocksLoading(true);
      const response = await marketApi.getHotStocks(page, 20);
      setHotStocksData(response);
      setHotStocksPage(page);
    } catch (err) {
      console.error('Failed to load hot stocks:', err);
    } finally {
      setHotStocksLoading(false);
    }
  }, []);

  const loadStockList = useCallback(async (page: number, search?: string) => {
    try {
      setStockListLoading(true);
      const response = await quotesApi.list({ page, page_size: 20, search: search || undefined });
      setStockListData(response);
      setStockListPage(page);
    } catch (err) {
      console.error('Failed to load stock list:', err);
    } finally {
      setStockListLoading(false);
    }
  }, []);

  const handleRefreshStock = useCallback(async (stockCode: string) => {
    try {
      setRefreshingStock(stockCode);
      const result = await quotesApi.refresh(stockCode);
      if (result.success) {
        toast.success(result.message);
        await loadStockList(stockListPage, stockListSearch);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshingStock(null);
    }
  }, [stockListPage, stockListSearch, loadStockList, toast]);

  const handleStockListSearch = useCallback(() => {
    loadStockList(1, stockListSearch);
  }, [stockListSearch, loadStockList]);

  const handleViewHistory = useCallback(async (stockCode: string, stockName: string | null) => {
    setHistoryStockCode(stockCode);
    setHistoryStockName(stockName);
    setShowHistoryModal(true);
    setHistoryPage(1);
    await loadHistory(stockCode, 1);
  }, []);

  const loadHistory = useCallback(async (stockCode: string, page: number) => {
    try {
      setHistoryLoading(true);
      const response = await quotesApi.getAllHistory(stockCode, { page, page_size: 20 });
      setHistoryData(response);
      setHistoryPage(page);
    } catch (err) {
      console.error('Failed to load history:', err);
      toast.error('加载历史数据失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  // ESC关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHistoryModal) {
        setShowHistoryModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showHistoryModal]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatAmount = (value: number): string => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
    if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
    return value.toFixed(2);
  };

  const sentiment = data?.market_sentiment?.data;
  const indices = data?.index_overview?.data?.indices || [];
  const hotStocks = hotStocksData?.data?.stocks || [];
  const hotStocksPagination = hotStocksData?.pagination;


  const filteredAndSortedStocks = useMemo(() => {
    let stocks = hotStocks;
    if (searchText) {
      stocks = stocks.filter(stock =>
        stock.code.toLowerCase().includes(searchText.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    stocks = [...stocks].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortBy === 'change_pct') { aVal = a.change_pct; bVal = b.change_pct; }
      else if (sortBy === 'volume') { aVal = a.volume; bVal = b.volume; }
      else if (sortBy === 'amount') { aVal = a.amount; bVal = b.amount; }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return stocks;
  }, [hotStocks, searchText, sortBy, sortOrder]);

  if (loading && !data) {
    return (
      <div className="h-full bg-ios-gray flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-ios-gray p-4 md:p-6 overflow-auto">
      <div className="space-y-4">
        {/* 控制栏 + 市场概览 - 合并为一行 */}
        <GlassCard className="p-3 rounded-[7px]">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* 更新时间 */}
            {data?.market_sentiment?.updated_at && (
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] text-gray-400">更新时间: {data.market_sentiment.updated_at}</span>
              </div>
            )}
            
            {/* 分隔线 */}
            {data?.market_sentiment?.updated_at && (
              <div className="hidden lg:block w-px h-6 bg-gray-200"></div>
            )}
            
            {/* 市场情绪指标 */}
            <div className="flex-1 overflow-x-auto">
              {sentiment ? (
                <div className="flex items-center gap-4 min-w-max">
                  {/* 恐惧贪婪指数 */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xl font-bold ${sentiment.fear_greed_index >= 50 ? 'text-profit-green' : 'text-loss-red'}`}>
                      {sentiment.fear_greed_index}
                    </span>
                    <span className={`text-xs font-medium ${sentiment.market_mood.includes('乐观') || sentiment.market_mood.includes('贪婪') ? 'text-profit-green' : sentiment.market_mood.includes('悲观') || sentiment.market_mood.includes('恐惧') ? 'text-loss-red' : 'text-gray-600'}`}>
                      {sentiment.market_mood}
                    </span>
                  </div>
                  
                  <div className="w-px h-4 bg-gray-200"></div>
                  
                  {/* 交易活跃度 */}
                  <span className={`text-xs font-medium ${sentiment.trading_activity === '活跃' ? 'text-profit-green' : sentiment.trading_activity === '低迷' ? 'text-loss-red' : 'text-gray-600'}`}>
                    {sentiment.trading_activity}
                  </span>
                  
                  <div className="w-px h-4 bg-gray-200"></div>
                  
                  {/* 涨跌家数 */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-profit-green font-medium">{sentiment.up_count || 0}</span>
                    <span className="text-gray-400">涨</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-loss-red font-medium">{sentiment.down_count || 0}</span>
                    <span className="text-gray-400">跌</span>
                  </div>
                  
                  <div className="w-px h-4 bg-gray-200"></div>
                  
                  {/* 涨停跌停 */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-profit-green font-medium">{sentiment.limit_up_count || 0}</span>
                    <span className="text-gray-400">停</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-loss-red font-medium">{sentiment.limit_down_count || 0}</span>
                    <span className="text-gray-400">停</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-400">点击刷新获取市场数据</span>
              )}
            </div>
            
            {/* 分隔线 */}
            <div className="hidden lg:block w-px h-6 bg-gray-200"></div>
            
            {/* 大盘指数 */}
            <div className="flex-shrink-0 overflow-x-auto">
              {indices.length > 0 ? (
                <div className="flex items-center gap-4 min-w-max">
                  {indices.slice(0, 4).map((index) => (
                    <div key={index.code} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">{index.name}</span>
                      <span className="text-xs font-bold">{index.current.toFixed(0)}</span>
                      <span className={`text-xs font-medium ${index.change_pct >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                        {index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </GlassCard>

        {error && <div className="bg-loss-red/10 text-loss-red px-4 py-2 rounded-lg text-sm">{error}</div>}


        {/* 股票列表/热门股票 Tab */}
        <GlassCard className="p-4 rounded-[7px]">
          {/* Tab 切换 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('stock_list')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'stock_list' ? 'bg-space-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                股票列表
              </button>
              <button
                onClick={() => setActiveTab('hot_stocks')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${activeTab === 'hot_stocks' ? 'bg-space-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                热门股票
              </button>
            </div>
            <span className="text-[10px] text-gray-400">
              {activeTab === 'stock_list' 
                ? (stockListData ? `共 ${stockListData.total} 只` : '0 只')
                : (hotStocksPagination ? `共 ${hotStocksPagination.total} 只` : `${hotStocks.length} 只`)}
            </span>
          </div>

          {/* 股票列表 Tab */}
          {activeTab === 'stock_list' && (
            <>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={stockListSearch}
                  onChange={(e) => setStockListSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStockListSearch()}
                  placeholder="搜索股票代码..."
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 border-none outline-none focus:ring-2 focus:ring-info-blue/20"
                />
                <button
                  onClick={handleStockListSearch}
                  className="px-4 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  搜索
                </button>
              </div>
              
              {stockListLoading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : stockListData && stockListData.items.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-[10px] text-gray-400 uppercase">
                          <th className="pb-2 font-medium">代码</th>
                          <th className="pb-2 font-medium">名称</th>
                          <th className="pb-2 font-medium">开盘</th>
                          <th className="pb-2 font-medium">最高</th>
                          <th className="pb-2 font-medium">最低</th>
                          <th className="pb-2 font-medium">收盘</th>
                          <th className="pb-2 font-medium">昨收</th>
                          <th className="pb-2 font-medium">涨跌幅</th>
                          <th className="pb-2 font-medium">成交量</th>
                          <th className="pb-2 font-medium">成交额</th>
                          <th className="pb-2 font-medium">交易日期</th>
                          <th className="pb-2 font-medium text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stockListData.items.map((stock) => {
                          const changePct = stock.change_pct || (stock.prev_close > 0 ? ((stock.close_price - stock.prev_close) / stock.prev_close) * 100 : 0);
                          return (
                            <tr key={stock.stock_code} className="hover:bg-white/30 transition-colors">
                              <td className="py-2">
                                <StockCodeLink code={stock.stock_code} onClick={setSelectedStockCode} className="font-mono" showName={false} />
                              </td>
                              <td className="py-2 text-gray-700">{stock.stock_name || '-'}</td>
                              <td className="py-2 text-gray-600">¥{stock.open_price.toFixed(2)}</td>
                              <td className="py-2 text-profit-green">¥{stock.high_price.toFixed(2)}</td>
                              <td className="py-2 text-loss-red">¥{stock.low_price.toFixed(2)}</td>
                              <td className="py-2 font-medium">¥{stock.close_price.toFixed(2)}</td>
                              <td className="py-2 text-gray-500">¥{stock.prev_close.toFixed(2)}</td>
                              <td className={`py-2 font-medium ${changePct >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                              </td>
                              <td className="py-2 text-gray-600">{formatAmount(stock.volume)}</td>
                              <td className="py-2 text-gray-600">{formatAmount(stock.amount)}</td>
                              <td className="py-2 text-gray-500 text-xs">{stock.trade_date}</td>
                              <td className="py-2">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleViewHistory(stock.stock_code, stock.stock_name)}
                                    className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors cursor-pointer"
                                  >
                                    历史: {stock.record_count}条
                                  </button>
                                  <button
                                    onClick={() => handleRefreshStock(stock.stock_code)}
                                    disabled={refreshingStock === stock.stock_code || !isAuthenticated}
                                    className="px-2 py-1 text-xs rounded bg-info-blue/10 text-info-blue hover:bg-info-blue/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {refreshingStock === stock.stock_code ? '...' : '更新'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {stockListData.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">第 {stockListData.page} / {stockListData.total_pages} 页</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => loadStockList(1, stockListSearch)} disabled={stockListPage === 1 || stockListLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">首页</button>
                        <button onClick={() => loadStockList(stockListPage - 1, stockListSearch)} disabled={stockListPage === 1 || stockListLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">上一页</button>
                        <span className="px-3 py-1 text-xs bg-blue-500 text-white rounded">{stockListPage}</span>
                        <button onClick={() => loadStockList(stockListPage + 1, stockListSearch)} disabled={stockListPage >= stockListData.total_pages || stockListLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">下一页</button>
                        <button onClick={() => loadStockList(stockListData.total_pages, stockListSearch)} disabled={stockListPage >= stockListData.total_pages || stockListLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">末页</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">暂无数据</div>
              )}
            </>
          )}


          {/* 热门股票 Tab */}
          {activeTab === 'hot_stocks' && (
            <>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜索代码或名称..."
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 border-none outline-none focus:ring-2 focus:ring-info-blue/20"
                />
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 border-none outline-none focus:ring-2 focus:ring-info-blue/20 cursor-pointer"
                  >
                    <option value="change_pct">按涨跌幅</option>
                    <option value="volume">按成交量</option>
                    <option value="amount">按成交额</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    {sortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </div>
              </div>

              {hotStocksLoading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : filteredAndSortedStocks.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-[10px] text-gray-400 uppercase">
                          <th className="pb-2 font-medium">代码</th>
                          <th className="pb-2 font-medium">名称</th>
                          <th className="pb-2 font-medium">现价</th>
                          <th className="pb-2 font-medium">涨跌幅</th>
                          <th className="pb-2 font-medium">成交量</th>
                          <th className="pb-2 font-medium">成交额</th>
                          <th className="pb-2 font-medium">换手率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAndSortedStocks.slice(0, 20).map((stock) => (
                          <tr key={stock.code} className="hover:bg-white/30 transition-colors">
                            <td className="py-2">
                              <StockCodeLink code={stock.code} onClick={setSelectedStockCode} className="font-mono" showName={false} />
                            </td>
                            <td className="py-2 text-gray-700">{stock.name}</td>
                            <td className="py-2 font-medium">¥{stock.current_price.toFixed(2)}</td>
                            <td className={`py-2 font-medium ${stock.change_pct >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                              {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                            </td>
                            <td className="py-2 text-gray-600">{formatAmount(stock.volume)}</td>
                            <td className="py-2 text-gray-600">{formatAmount(stock.amount)}</td>
                            <td className="py-2 text-gray-600">{stock.turnover_rate.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hotStocksPagination && hotStocksPagination.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">第 {hotStocksPagination.page} / {hotStocksPagination.total_pages} 页</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => loadHotStocks(1)} disabled={hotStocksPage === 1 || hotStocksLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">首页</button>
                        <button onClick={() => loadHotStocks(hotStocksPage - 1)} disabled={hotStocksPage === 1 || hotStocksLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">上一页</button>
                        <span className="px-3 py-1 text-xs bg-blue-500 text-white rounded">{hotStocksPage}</span>
                        <button onClick={() => loadHotStocks(hotStocksPage + 1)} disabled={hotStocksPage >= hotStocksPagination.total_pages || hotStocksLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">下一页</button>
                        <button onClick={() => loadHotStocks(hotStocksPagination.total_pages)} disabled={hotStocksPage >= hotStocksPagination.total_pages || hotStocksLoading} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">末页</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  {searchText ? '未找到匹配的股票' : '暂无数据，请点击刷新'}
                </div>
              )}
            </>
          )}
        </GlassCard>
      </div>

      <StockDetailDrawer stockCode={selectedStockCode} onClose={() => setSelectedStockCode(null)} />

      {/* 历史数据弹窗 */}
      {showHistoryModal && historyStockCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  历史行情 - {historyStockCode} {historyStockName && `(${historyStockName})`}
                </h2>
                <p className="text-sm text-gray-500">
                  {historyLoading ? '加载中...' : `共 ${historyData?.total || 0} 条记录`}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {historyLoading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : historyData && historyData.items.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">交易日期</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">开盘</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">最高</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">最低</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">收盘</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">涨跌幅</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">成交量</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">创建时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.items.map((item, index) => (
                      <tr key={`${item.trade_date}-${index}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-medium">{item.trade_date}</td>
                        <td className="px-3 py-2 text-xs">¥{item.open_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs text-profit-green">¥{item.high_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs text-loss-red">¥{item.low_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs font-medium">¥{item.close_price.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-xs font-medium ${item.change_pct >= 0 ? 'text-profit-green' : 'text-loss-red'}`}>
                          {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{formatAmount(item.volume)}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">{item.created_at || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">暂无历史数据</div>
              )}
            </div>

            {/* 分页 */}
            {historyData && historyData.total_pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-gray-500">第 {historyData.page} / {historyData.total_pages} 页</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => loadHistory(historyStockCode, historyPage - 1)} 
                    disabled={historyPage <= 1 || historyLoading} 
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button 
                    onClick={() => loadHistory(historyStockCode, historyPage + 1)} 
                    disabled={historyPage >= historyData.total_pages || historyLoading} 
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SentimentCardProps {
  label: string;
  value: string | number;
  color: 'profit' | 'loss' | 'neutral';
}

// 保留组件定义以备后用，但当前布局不使用
const _SentimentCard: React.FC<SentimentCardProps> = ({ label, value, color }) => {
  const colorClass = color === 'profit' ? 'text-profit-green' : color === 'loss' ? 'text-loss-red' : 'text-space-black';
  return (
    <div className="bg-gray-50/50 rounded-lg p-3">
      <div className="text-[9px] text-gray-400 uppercase mb-1">{label}</div>
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
    </div>
  );
};

export default MarketData;
