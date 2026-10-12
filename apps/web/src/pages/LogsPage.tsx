import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { LogItem, LogLevel } from '@gitforksync/shared';
import { api } from '../api/client.js';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await api.getLogs({
        level: levelFilter,
        search: search || undefined,
        limit: 150,
      });
      setLogs(res.logs);
    } catch {}
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, search]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchLogs, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, levelFilter, search]);

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.module}] ${l.message} ${
            l.details ? `\nDetails: ${l.details}` : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            <span>系统日志中心</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>所有 Token 和敏感授权已由服务端自动脱敏处理，安全可复制</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pr-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <span>实时刷新</span>
          </label>

          <button
            onClick={handleCopyLogs}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制脱敏日志'}</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索日志关键词、模块..."
            className="w-full pl-10 pr-4 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        {/* Level pills */}
        <div className="flex items-center overflow-x-auto no-scrollbar gap-1.5 pt-0.5 pb-0.5 touch-pan-x">
          {[
            { id: 'all', label: '全部' },
            { id: 'info', label: 'INFO' },
            { id: 'warn', label: 'WARN' },
            { id: 'error', label: 'ERROR' },
            { id: 'debug', label: 'DEBUG' },
          ].map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => setLevelFilter(lvl.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                levelFilter === lvl.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-sans">暂无匹配的日志记录</div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="p-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-start justify-between cursor-pointer space-x-2"
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                      <span className="text-slate-400 whitespace-nowrap text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                          log.level === 'error'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : log.level === 'warn'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : log.level === 'info'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-[10px]">
                        [{log.module}]
                      </span>
                      <span className="text-slate-900 dark:text-slate-100 break-words flex-1 min-w-[200px]">{log.message}</span>
                    </div>

                    {log.details && (
                      <span className="text-slate-400 hover:text-slate-600 flex-shrink-0 pt-0.5">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>

                  {isExpanded && log.details && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-950 text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap border border-slate-800">
                      {log.details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
