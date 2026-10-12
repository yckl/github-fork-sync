import React, { useState } from 'react';
import {
  FolderGit2,
  GitFork,
  Radio,
  CheckCircle2,
  ArrowDownCircle,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import type { DashboardStats, RepositoryItem } from '@gitforksync/shared';
import { api } from '../api/client.js';
import { TaskProgressBanner } from '../components/TaskProgressBanner.js';

interface DashboardPageProps {
  stats: DashboardStats | null;
  onRefresh: () => void;
  onNavigateToRepo: (repoId: number) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  onRefresh,
  onNavigateToRepo,
  onNavigateToTab,
}) => {
  const [triggeringCheckAll, setTriggeringCheckAll] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [syncingRepoId, setSyncingRepoId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const handleCheckAll = async () => {
    setTriggeringCheckAll(true);
    setMessage(null);
    try {
      const res = await api.checkAllJobs();
      setMessage(res.message);
      onRefresh();
    } catch (err: any) {
      setMessage(`触发失败: ${err.message}`);
    } finally {
      setTriggeringCheckAll(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setMessage(null);
    try {
      const res = await api.discoverRepositories();
      setMessage(`扫描完成: 共扫描 ${res.result.totalScanned} 个仓库，发现 ${res.result.forksCount} 个 Fork`);
      onRefresh();
    } catch (err: any) {
      setMessage(`扫描失败: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handleQuickSync = async (repoId: number) => {
    setSyncingRepoId(repoId);
    try {
      await api.syncRepo(repoId);
      setMessage('同步任务已加入队列');
      onRefresh();
    } catch (err: any) {
      setMessage(`发起同步失败: ${err.message}`);
    } finally {
      setSyncingRepoId(null);
    }
  };

  // Metric Cards
  const metricCards = [
    {
      label: '仓库总数',
      value: stats.totalRepos,
      sub: `${stats.forkRepos} 个 Fork / ${Math.max(0, stats.totalRepos - stats.forkRepos)} 个自建项目`,
      icon: FolderGit2,
      color: 'text-slate-800 dark:text-slate-200',
      bg: 'bg-slate-100 dark:bg-slate-800',
    },
    {
      label: 'Fork 数量',
      value: stats.forkRepos,
      sub: '已识别的上游关联',
      icon: GitFork,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: '监控数量',
      value: stats.monitoredRepos,
      sub: '已启用自动检测',
      icon: Radio,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
    },
    {
      label: '已是最新',
      value: stats.upToDateCount,
      sub: '与上游分支完全一致',
      icon: CheckCircle2,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/40',
    },
    {
      label: '待同步',
      value: stats.pendingSyncCount,
      sub: '上游有新提交 (安全落后)',
      icon: ArrowDownCircle,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      highlight: stats.pendingSyncCount > 0,
    },
    {
      label: '需要处理',
      value: stats.needsAttentionCount,
      sub: '分支分叉或历史不兼容',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      highlight: stats.needsAttentionCount > 0,
    },
    {
      label: '同步失败',
      value: stats.failedSyncCount,
      sub: '最近推送或验证异常',
      icon: XCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
    },
    {
      label: '执行中任务',
      value: stats.runningJobsCount,
      sub: '当前后台队列处理',
      icon: Play,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>控制台概览</span>
            {stats.runningJobsCount > 0 && (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>任务执行中</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>下次自动检查: {stats.nextCheckTime ? new Date(stats.nextCheckTime).toLocaleTimeString() : '排队中'}</span>
            </span>
            <span>•</span>
            <span>API 配额: {stats.apiRateLimit.remaining} / {stats.apiRateLimit.limit}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition disabled:opacity-50"
          >
            {discovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>扫描新仓库</span>
          </button>

          <button
            onClick={handleCheckAll}
            disabled={triggeringCheckAll}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
          >
            {triggeringCheckAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>立即检查所有仓库</span>
          </button>
        </div>
      </div>

      {/* Real-time batch task progress bar banner */}
      <TaskProgressBanner onRefresh={onRefresh} />

      {message && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            关闭
          </button>
        </div>
      )}

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {metricCards.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-3xl bg-white dark:bg-slate-900 border transition ${
                m.highlight
                  ? 'border-emerald-500/60 shadow-sm shadow-emerald-500/10'
                  : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</span>
                <div className={`p-2 rounded-xl ${m.bg}`}>
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {m.value}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Two Columns: Recent Checks & Recent Syncs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Checks */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span>最近检测记录</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('repos')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-0.5"
            >
              <span>查看全部仓库</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentChecks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">暂无检测记录，点击上方按钮开始检测</div>
            ) : (
              stats.recentChecks.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onNavigateToRepo(c.repoId)}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs hover:border-emerald-400/50 dark:hover:border-emerald-600/50 cursor-pointer transition group"
                  title="点击查看仓库详情"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">
                        {c.repoFullName || c.repoName || `仓库 #${c.repoId}`}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          c.comparisonStatus === 'up_to_date'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : c.comparisonStatus === 'behind_safe'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold'
                            : c.comparisonStatus === 'diverged'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {c.comparisonStatus === 'up_to_date' && '已是最新'}
                        {c.comparisonStatus === 'behind_safe' && `可同步 (+${c.aheadBy})`}
                        {c.comparisonStatus === 'diverged' && '分支分叉'}
                        {c.comparisonStatus === 'ahead' && `领先 (+${c.behindBy})`}
                        {c.comparisonStatus === 'incompatible' && '历史不兼容'}
                        {c.comparisonStatus === 'error' && '检测失败'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {c.summary || c.errorMessage || '状态检查完成'}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 flex-shrink-0">
                    {new Date(c.finishedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Syncs */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>最近同步记录</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('tasks')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-0.5"
            >
              <span>查看任务中心</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentSyncs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">暂无同步记录</div>
            ) : (
              stats.recentSyncs.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  onClick={() => onNavigateToRepo(s.repoId)}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs hover:border-emerald-400/50 dark:hover:border-emerald-600/50 cursor-pointer transition group"
                  title="点击查看仓库详情"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">
                        {s.repoFullName || s.repoName || `仓库 #${s.repoId}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({s.targetBranch})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          s.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {s.status === 'success' ? '同步成功' : '推送失败'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                      {s.afterSha ? `SHA: ${s.afterSha.slice(0, 7)}` : s.gitError || '未确认'}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 flex-shrink-0">
                    {new Date(s.finishedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
