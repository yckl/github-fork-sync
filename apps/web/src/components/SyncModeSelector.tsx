import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  GitBranch,
  Eye,
  Check,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import type { SyncMode } from '@gitforksync/shared';

interface SyncModeOption {
  value: SyncMode;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  iconBg: string;
  activeBg: string;
}

const syncModeOptions: SyncModeOption[] = [
  {
    value: 'mode_b',
    title: '模式 B：自动同步主分支',
    badge: '推荐 · 严格快进',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    description: '与 GitHub 网页端「Sync fork」一致，检测到上游更新且无冲突时，直接纯快进同步到你的主分支（如 main/master）',
    icon: Zap,
    accentColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    activeBg: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200',
  },
  {
    value: 'mode_a',
    title: '模式 A：自动同步到独立分支',
    badge: '安全隔离快照',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    description: '拉取上游最新提交至独立的隔离分支（默认 upstream-sync），你的主分支完全不受影响，需手动合入',
    icon: GitBranch,
    accentColor: 'text-sky-500',
    iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20',
    activeBg: 'bg-sky-500/10 border-sky-500/40 text-sky-950 dark:text-sky-200',
  },
  {
    value: 'mode_c',
    title: '模式 C：仅自动检测版本',
    badge: '只读提醒',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    description: '仅定期检测上游最新提交数并在控制台提醒，绝不自动发起任何 Git 推送写入操作',
    icon: Eye,
    accentColor: 'text-amber-500',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    activeBg: 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-200',
  },
];

interface SyncModeSelectorProps {
  value: SyncMode;
  onChange: (value: SyncMode) => void;
  disabled?: boolean;
}

export const SyncModeSelector: React.FC<SyncModeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption =
    syncModeOptions.find((opt) => opt.value === value) || syncModeOptions[0];
  const CurrentIcon = currentOption.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: SyncMode) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 shadow-sm select-none ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-900 shadow-md'
            : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 hover:bg-white dark:bg-slate-800/80 hover:dark:bg-slate-850 hover:border-emerald-500/60'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentOption.iconBg}`}
          >
            <CurrentIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {currentOption.title}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentOption.badgeColor}`}
              >
                {currentOption.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {currentOption.description}
            </p>
          </div>
        </div>

        <div className="flex items-center pl-2 shrink-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 transition-transform duration-200 ${
              isOpen ? 'rotate-180 bg-emerald-500/10 text-emerald-500' : 'text-slate-400'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl p-2 space-y-1.5 animate-in fade-in-50 zoom-in-95 duration-150 backdrop-blur-md ring-1 ring-black/5">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>选择同步策略模式</span>
            <span className="text-[10px] font-normal lowercase">Esc 关闭</span>
          </div>

          {syncModeOptions.map((opt) => {
            const isSelected = opt.value === value;
            const Icon = opt.icon;

            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 border ${
                  isSelected
                    ? `${opt.activeBg} shadow-sm`
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${opt.iconBg}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-bold text-xs sm:text-sm ${
                          isSelected
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {opt.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${opt.badgeColor}`}
                      >
                        {opt.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center pl-1">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
