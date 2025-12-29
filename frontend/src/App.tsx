import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard, Agents, Portfolio, Transactions, Templates, Compare, Settings, SystemSettings, MarketData, LLMLogs } from './pages';
import { Layout } from './components/layout';
import { ThemeProvider, AuthProvider, ToastProvider } from './contexts';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/llm-logs" element={<LLMLogs />} />
                <Route path="/market" element={<MarketData />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/providers" element={<Settings />} />
                <Route path="/settings" element={<SystemSettings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
