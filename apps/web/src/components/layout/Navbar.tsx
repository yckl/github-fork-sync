import React from 'react';
import {
  GitFork,
  LayoutDashboard,
  FolderGit2,
  ListTodo,
  FileText,
  Settings,
  Sun,
  Moon,
  ShieldCheck,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import type { AccountInfo, DashboardStats } from '@gitforksync/shared';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  account: AccountInfo | null;
  stats?: DashboardStats | null;
  isDark: boolean;
  onToggleDark: () => void;
  onDisconnect: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  account,
  stats,
  isDark,
  onToggleDark,
  onDisconnect,
}) => {
  const navItems = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
    { id: 'repos', label: '仓库管理', icon: FolderGit2 },
    { id: 'tasks', label: '任务中心', icon: ListTodo },
    { id: 'logs', label: '运行日志', icon: FileText },
    { id: 'settings', label: '系统设置', icon: Settings },
  ];

  const rateLimit = stats?.apiRateLimit;
  const runningJobs = stats?.runningJobsCount || 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand logo & name */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <GitFork className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                GitForkSync
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                本地版
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              GitHub Fork 自动同步管理器
            </p>
          </div>
        </div>

        {/* Center: Tactile Pill Navigation Tabs */}
        <nav className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-full border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-500' : ''}`} />
                <span>{item.label}</span>
                {item.id === 'tasks' && runningJobs > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold leading-none text-white bg-emerald-500 rounded-full animate-pulse">
                    {runningJobs}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Telemetry pill badges & user avatar */}
        <div className="flex items-center space-x-3">
          {/* Rate limit telemetry */}
          {rateLimit && (
            <div
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              title={`API 剩余额度: ${rateLimit.remaining} / ${rateLimit.limit}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  rateLimit.remaining > 500
                    ? 'bg-emerald-500'
                    : rateLimit.remaining > 50
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500 animate-ping'
                }`}
              />
              <span>API: {rateLimit.remaining}</span>
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="切换深色/浅色模式"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User profile pill */}
          {account ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <img
                src={account.avatarUrl}
                alt={account.login}
                className="w-7 h-7 rounded-full ring-1 ring-emerald-500/40"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 hidden sm:inline">
                {account.login}
              </span>
              <button
                onClick={onDisconnect}
                className="p-1 text-slate-400 hover:text-rose-500 transition"
                title="断开账号连接"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/50">
              <span>未连接账号</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
