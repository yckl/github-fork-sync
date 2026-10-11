import React, { useState, useEffect } from 'react';
import type { AccountInfo, DashboardStats } from '@gitforksync/shared';
import { api } from './api/client.js';
import { Navbar } from './components/layout/Navbar.js';
import { WizardPage } from './pages/WizardPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RepositoriesPage } from './pages/RepositoriesPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Dark mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleDark = () => setIsDark(!isDark);

  const fetchStatusAndStats = async () => {
    try {
      const authRes = await api.getAuthStatus();
      setAccount(authRes.account);

      if (authRes.account) {
        const dashRes = await api.getDashboard();
        setStats(dashRes.stats);
      }
    } catch (err) {
      // Offline / connecting
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndStats();
    // Poll stats every 10s
    const timer = setInterval(() => {
      if (account) {
        api.getDashboard().then((res) => setStats(res.stats)).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [Boolean(account)]);

  const handleDisconnect = async () => {
    if (confirm('确认断开 GitHub 账号连接？已监控的仓库设置将保留在本地，但会停止自动同步。')) {
      await api.disconnectAccount();
      setAccount(null);
      setStats(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-500">正在连接本地服务...</span>
        </div>
      </div>
    );
  }

  // If no account is connected, show setup wizard
  if (!account) {
    return (
      <WizardPage
        onComplete={(newAccount) => {
          setAccount(newAccount);
          fetchStatusAndStats();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        account={account}
        stats={stats}
        isDark={isDark}
        onToggleDark={toggleDark}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardPage
            stats={stats}
            onRefresh={fetchStatusAndStats}
            onNavigateToRepo={(id) => {
              setCurrentTab('repos');
            }}
            onNavigateToTab={setCurrentTab}
          />
        )}

        {currentTab === 'repos' && <RepositoriesPage onRefreshStats={fetchStatusAndStats} />}

        {currentTab === 'tasks' && <TasksPage />}

        {currentTab === 'logs' && <LogsPage />}

        {currentTab === 'settings' && (
          <SettingsPage
            account={account}
            onAccountUpdated={fetchStatusAndStats}
            onDisconnect={handleDisconnect}
          />
        )}
      </main>
    </div>
  );
};
