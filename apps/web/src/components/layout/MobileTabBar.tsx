import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  ListTodo,
  FileText,
  Settings,
} from 'lucide-react';
import type { DashboardStats } from '@gitforksync/shared';

interface MobileTabBarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  stats?: DashboardStats | null;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentTab,
  onTabChange,
  stats,
}) => {
  const runningJobs = stats?.runningJobsCount || 0;

  const navItems = [
    { id: 'dashboard', label: '概览', icon: LayoutDashboard },
    { id: 'repos', label: '仓库', icon: FolderGit2 },
    { id: 'tasks', label: '任务', icon: ListTodo, badge: runningJobs },
    { id: 'logs', label: '日志', icon: FileText },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <nav
      data-slot="mobile-bottom-dock"
      aria-label="移动端底部导航栏"
      className="fixed bottom-2.5 inset-x-3 z-40 md:hidden select-none"
    >
      <div className="mx-auto max-w-md rounded-2xl sm:rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] p-1.5 flex items-center justify-around ring-1 ring-black/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-emerald-600 dark:text-emerald-400' : ''
                  }`}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white shadow-xs animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
