import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Radio,
  ExternalLink,
  RefreshCw,
  Zap,
  Play,
  Settings,
  AlertCircle,
  GitFork,
  ArrowUpRight,
  ChevronDown,
  Trash2,
  FolderGit2,
} from 'lucide-react';
import type { RepositoryItem, SyncMode } from '@gitforksync/shared';
import { api } from '../api/client.js';
import { RepoDetailPage } from './RepoDetailPage.js';
import { TaskProgressBanner } from '../components/TaskProgressBanner.js';

interface RepositoriesPageProps {
  onRefreshStats: () => void;
}

export const RepositoriesPage: React.FC<RepositoriesPageProps> = ({ onRefreshStats }) => {
  const [repos, setRepos] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [repoTypeFilter, setRepoTypeFilter] = useState<'all' | 'forks' | 'self'>('all');
  const [monitoredOnly, setMonitoredOnly] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await api.getRepositories({
        search: search || undefined,
        monitoredOnly: monitoredOnly || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setRepos(res.repos);
    } catch (err: any) {
      setActionMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [search, statusFilter, monitoredOnly]);

  const forkCount = repos.filter((r) => r.isFork).length;
  const selfCount = repos.filter((r) => !r.isFork).length;

  const displayedRepos = repos.filter((r) => {
    if (repoTypeFilter === 'forks' && !r.isFork) return false;
    if (repoTypeFilter === 'self' && r.isFork) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedRepos.length && displayedRepos.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedRepos.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBatchMonitor = async (enabled: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await api.batchMonitor(Array.from(selectedIds), enabled);
      setActionMessage(`已批量${enabled ? '启用' : '关闭'} ${selectedIds.size} 个仓库的监控`);
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`操作失败: ${err.message}`);
    }
  };

  const handleBatchSyncMode = async (mode: SyncMode) => {
    if (selectedIds.size === 0) return;
    try {
      await api.batchSyncMode(Array.from(selectedIds), mode);
      setActionMessage(`已批量更新 ${selectedIds.size} 个仓库为 ${mode}`);
      fetchRepos();
    } catch (err: any) {
      setActionMessage(`操作失败: ${err.message}`);
    }
  };

  const handleBatchSync = async () => {
    if (selectedIds.size === 0) return;
    const eligibleIds = Array.from(selectedIds).filter((id) => {
      const r = repos.find((repo) => repo.id === id);
      return r && (r.isFork || Boolean(r.syncConfig?.upstreamRepo));
    });

    if (eligibleIds.length === 0) {
      setActionMessage('所选仓库均为自建原生项目，无上游代码需同步');
      return;
    }

    try {
      const res = await api.syncSelectedJobs(eligibleIds);
      const skippedCount = selectedIds.size - eligibleIds.length;
      setActionMessage(`${res.message}${skippedCount > 0 ? `（已自动跳过 ${skippedCount} 个无需同步的自建项目）` : ''}`);
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`触发批量同步失败: ${err.message}`);
    }
  };

  const handleDeleteRepo = async (repo: RepositoryItem) => {
    if (!window.confirm(`确定要从系统移除仓库「${repo.name}」吗？\n\n提示：仅从本地管理列表移除记录，不会在 GitHub 上删除任何远程代码。`)) {
      return;
    }
    try {
      await api.deleteRepository(repo.id);
      setActionMessage(`已移除仓库: ${repo.name}`);
      const nextSelected = new Set(selectedIds);
      nextSelected.delete(repo.id);
      setSelectedIds(nextSelected);
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`移除失败: ${err.message}`);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要从系统批量移除选中的 ${selectedIds.size} 个仓库吗？\n\n提示：仅从本地管理列表移除记录，不会在 GitHub 上删除任何远程代码。`)) {
      return;
    }
    try {
      const res = await api.batchDeleteRepositories(Array.from(selectedIds));
      setActionMessage(res.message);
      setSelectedIds(new Set());
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`批量移除失败: ${err.message}`);
    }
  };

  const handleSingleCheck = async (id: number) => {
    try {
      const res = await api.checkRepo(id);
      setActionMessage(res.message);
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`检测失败: ${err.message}`);
    }
  };

  const handleSingleSync = async (id: number) => {
    try {
      const res = await api.syncRepo(id);
      setActionMessage(res.message);
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`同步失败: ${err.message}`);
    }
  };

  const handleToggleAutoCheck = async (repo: RepositoryItem) => {
    const nextVal = !repo.syncConfig?.autoCheckEnabled;
    try {
      await api.updateRepoConfig(repo.id, { autoCheckEnabled: nextVal });
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`更新失败: ${err.message}`);
    }
  };

  const handleToggleAutoSync = async (repo: RepositoryItem) => {
    const nextVal = !repo.syncConfig?.autoSyncEnabled;
    try {
      await api.updateRepoConfig(repo.id, { autoSyncEnabled: nextVal });
      fetchRepos();
      onRefreshStats();
    } catch (err: any) {
      setActionMessage(`更新失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Real-time batch task progress bar banner */}
      <TaskProgressBanner onRefresh={() => { fetchRepos(); onRefreshStats(); }} />

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索仓库名称、Owner 或上游项目..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quick toggle pills & Type tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setRepoTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  repoTypeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                全部 ({repos.length})
              </button>
              <button
                onClick={() => setRepoTypeFilter('forks')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  repoTypeFilter === 'forks'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Fork 仓库 ({forkCount})
              </button>
              <button
                onClick={() => setRepoTypeFilter('self')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  repoTypeFilter === 'self'
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                自建项目 ({selfCount})
              </button>
            </div>

            <button
              onClick={() => setMonitoredOnly(!monitoredOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                monitoredOnly
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              仅显示已监控
            </button>
            <button
              onClick={fetchRepos}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              title="刷新列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center overflow-x-auto no-scrollbar gap-1.5 pt-1 pb-1 -mx-1 px-1 touch-pan-x">
          {[
            { id: 'all', label: '全部状态' },
            { id: 'behind_safe', label: '待同步 (安全落后)' },
            { id: 'up_to_date', label: '已是最新' },
            { id: 'ahead', label: '我方领先' },
            { id: 'diverged', label: '存在分叉' },
            { id: 'incompatible', label: '历史不兼容' },
            { id: 'error', label: '检测异常' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium transition ${
                statusFilter === f.id
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            关闭
          </button>
        </div>
      )}

      {/* Batch toolbar if items selected */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 font-semibold text-emerald-900 dark:text-emerald-200">
            <span>已选择 {selectedIds.size} 个仓库</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleBatchMonitor(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium text-xs flex-1 sm:flex-initial text-center"
            >
              开启监控
            </button>
            <button
              onClick={() => handleBatchMonitor(false)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium text-xs flex-1 sm:flex-initial text-center"
            >
              暂停监控
            </button>
            <button
              onClick={() => handleBatchSyncMode('mode_a')}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium text-xs flex-1 sm:flex-initial text-center"
            >
              设为模式 A
            </button>
            <button
              onClick={handleBatchSync}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm text-xs flex-1 sm:flex-initial text-center"
            >
              批量发起同步
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 font-medium inline-flex items-center justify-center space-x-1 text-xs flex-1 sm:flex-initial"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>批量移除 ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List View (< md screens) */}
      <div className="block md:hidden space-y-3">
        {/* Mobile quick select bar */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
          <button
            onClick={toggleSelectAll}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 font-medium"
          >
            {selectedIds.size === displayedRepos.length && displayedRepos.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>全选当前 ({displayedRepos.length})</span>
          </button>
          <span className="text-[11px] text-slate-400">已选 {selectedIds.size} 项</span>
        </div>

        {displayedRepos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            {repoTypeFilter === 'forks'
              ? '未找到 Fork 仓库。'
              : repoTypeFilter === 'self'
              ? '未找到自建项目。'
              : '未找到匹配的仓库。'}
          </div>
        ) : (
          displayedRepos.map((repo) => {
            const comp = repo.latestComparison;
            const isSelected = selectedIds.has(repo.id);
            const isSelfOwned = !repo.isFork && !repo.syncConfig?.upstreamRepo;

            return (
              <div
                key={repo.id}
                className={`p-4 rounded-3xl bg-white dark:bg-slate-900 border transition shadow-sm space-y-3 ${
                  isSelected
                    ? 'border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Header row: Checkbox, Name, Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <button
                      onClick={() => toggleSelectOne(repo.id)}
                      className="mt-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {repo.name}
                        </span>
                        {repo.htmlUrl && (
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-emerald-500 p-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {repo.isPrivate && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                            私有
                          </span>
                        )}
                        {repo.isArchived && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                            已归档
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {isSelfOwned ? (
                          <span className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-medium">
                            <FolderGit2 className="w-3 h-3 flex-shrink-0" />
                            <span>原生自建项目 (无上游)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1">
                            <GitFork className="w-3 h-3 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{repo.parentFullName || repo.syncConfig?.upstreamRepo}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sync status badge */}
                  <div className="flex-shrink-0">
                    {isSelfOwned ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        自建项目
                      </span>
                    ) : comp ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          comp.status === 'up_to_date'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : comp.status === 'behind_safe'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                            : comp.status === 'diverged'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : comp.status === 'ahead'
                            ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {comp.status === 'up_to_date' && '已是最新'}
                        {comp.status === 'behind_safe' && '待同步'}
                        {comp.status === 'diverged' && '分支分叉'}
                        {comp.status === 'ahead' && '我方领先'}
                        {comp.status === 'incompatible' && '不兼容'}
                        {comp.status === 'error' && '检测失败'}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">未检测</span>
                    )}
                  </div>
                </div>

                {/* Middle details: Branch & Commit comparison */}
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {isSelfOwned ? (
                      <span>分支: {repo.defaultBranch}</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div>目标: <span className="font-semibold text-slate-900 dark:text-white">{repo.syncConfig?.targetBranch || 'upstream-sync'}</span></div>
                        <div className="text-slate-400 text-[10px]">上游: {repo.syncConfig?.upstreamBranch || 'main'}</div>
                      </div>
                    )}
                  </div>

                  <div className="font-mono tabular-nums text-right">
                    {isSelfOwned ? (
                      <span className="text-slate-400 text-[10px]">无需同步</span>
                    ) : comp ? (
                      <div className="flex flex-col items-end gap-0.5">
                        {comp.aheadBy > 0 ? (
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px]">
                            +{comp.aheadBy} 上游新提交
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">0 新提交</span>
                        )}
                        {comp.behindBy > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium text-[10px]">
                            -{comp.behindBy} 独有
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px]">未检测</span>
                    )}
                  </div>
                </div>

                {/* Auto switch row */}
                {!isSelfOwned && (
                  <div className="flex items-center justify-between text-xs px-1 pt-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 text-[11px]">自动检测</span>
                      <button
                        onClick={() => handleToggleAutoCheck(repo)}
                        className={`w-8 h-4 rounded-full p-0.5 transition ${
                          repo.syncConfig?.autoCheckEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white transition transform ${
                            repo.syncConfig?.autoCheckEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 text-[11px]">自动同步</span>
                      <button
                        onClick={() => handleToggleAutoSync(repo)}
                        className={`w-8 h-4 rounded-full p-0.5 transition ${
                          repo.syncConfig?.autoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white transition transform ${
                            repo.syncConfig?.autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1.5 flex-1">
                    {!isSelfOwned && (
                      <button
                        onClick={() => handleSingleCheck(repo.id)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center space-x-1 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>检测</span>
                      </button>
                    )}

                    {!isSelfOwned && (
                      <button
                        onClick={() => handleSingleSync(repo.id)}
                        disabled={comp?.status !== 'behind_safe'}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition ${
                          comp?.status === 'behind_safe'
                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>同步</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedRepoId(repo.id)}
                      className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center space-x-1 transition"
                    >
                      <Settings className="w-3 h-3" />
                      <span>配置</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteRepo(repo)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="从列表中移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Repositories Table (Desktop >= md screens) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                    {selectedIds.size === repos.length && repos.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">仓库名称 / 上游来源</th>
                <th className="py-3 px-4">分支关系</th>
                <th className="py-3 px-4">提交对比</th>
                <th className="py-3 px-4">同步状态</th>
                <th className="py-3 px-4 text-center">自动检测</th>
                <th className="py-3 px-4 text-center">自动同步</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {displayedRepos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    {repoTypeFilter === 'forks'
                      ? '未找到 Fork 仓库。'
                      : repoTypeFilter === 'self'
                      ? '未找到自建项目。'
                      : '未找到匹配的仓库。点击上方“扫描新仓库”从 GitHub 获取。'}
                  </td>
                </tr>
              ) : (
                displayedRepos.map((repo) => {
                  const comp = repo.latestComparison;
                  const isSelected = selectedIds.has(repo.id);
                  const isSelfOwned = !repo.isFork && !repo.syncConfig?.upstreamRepo;

                  return (
                    <tr
                      key={repo.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition ${
                        isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <button onClick={() => toggleSelectOne(repo.id)} className="text-slate-400 hover:text-slate-600">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Repo info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 dark:text-white">{repo.name}</span>
                          {repo.htmlUrl && (
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-500"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {repo.isPrivate && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                              私有
                            </span>
                          )}
                          {repo.isArchived && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                              已归档
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-1 truncate max-w-xs">
                          {isSelfOwned ? (
                            <span className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-medium">
                              <FolderGit2 className="w-3 h-3" />
                              <span>原生自建项目 (无上游)</span>
                            </span>
                          ) : (
                            <>
                              <GitFork className="w-3 h-3 flex-shrink-0 text-slate-400" />
                              <span className="truncate">{repo.parentFullName || repo.syncConfig?.upstreamRepo}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Branches */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {isSelfOwned ? (
                          <>
                            <div>分支: {repo.defaultBranch}</div>
                            <div className="text-slate-400 text-[10px]">独立项目无需同步</div>
                          </>
                        ) : (
                          <>
                            <div>目标: {repo.syncConfig?.targetBranch || 'upstream-sync'}</div>
                            <div className="text-slate-400 text-[10px]">上游: {repo.syncConfig?.upstreamBranch || 'main'}</div>
                          </>
                        )}
                      </td>

                      {/* Ahead / Behind numbers */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                        {isSelfOwned ? (
                          <span className="text-slate-400 text-[11px]">— 自建项目 —</span>
                        ) : comp ? (
                          <div className="flex items-center space-x-2">
                            {comp.aheadBy > 0 ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold text-[11px]">
                                +{comp.aheadBy} 上游新提交
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">0 新提交</span>
                            )}
                            {comp.behindBy > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium text-[11px]">
                                -{comp.behindBy} 独有
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">未检测</span>
                        )}
                      </td>

                      {/* Sync status badge */}
                      <td className="py-3.5 px-4">
                        {isSelfOwned ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            自建项目 (无需同步)
                          </span>
                        ) : comp ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              comp.status === 'up_to_date'
                                ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                                : comp.status === 'behind_safe'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                                : comp.status === 'diverged'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : comp.status === 'ahead'
                                ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                : comp.status === 'self_owned'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {comp.status === 'up_to_date' && '已是最新'}
                            {comp.status === 'behind_safe' && '待同步'}
                            {comp.status === 'diverged' && '分支分叉'}
                            {comp.status === 'ahead' && '我方领先'}
                            {comp.status === 'incompatible' && '不兼容'}
                            {comp.status === 'self_owned' && '自建项目'}
                            {comp.status === 'error' && '检测失败'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">等待首次检测</span>
                        )}
                      </td>

                      {/* Auto-check switch */}
                      <td className="py-3.5 px-4 text-center">
                        {isSelfOwned ? (
                          <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                        ) : (
                          <button
                            onClick={() => handleToggleAutoCheck(repo)}
                            className={`w-9 h-5 rounded-full p-0.5 transition ${
                              repo.syncConfig?.autoCheckEnabled
                                ? 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition transform ${
                                repo.syncConfig?.autoCheckEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </td>

                      {/* Auto-sync switch */}
                      <td className="py-3.5 px-4 text-center">
                        {isSelfOwned ? (
                          <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                        ) : (
                          <button
                            onClick={() => handleToggleAutoSync(repo)}
                            className={`w-9 h-5 rounded-full p-0.5 transition ${
                              repo.syncConfig?.autoSyncEnabled
                                ? 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition transform ${
                                repo.syncConfig?.autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isSelfOwned ? (
                            <button
                              disabled
                              className="p-1.5 text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              title="自建项目无需检测"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSingleCheck(repo.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="立即检测"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isSelfOwned ? (
                            <button
                              disabled
                              className="p-1.5 text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              title="自建项目无需同步"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSingleSync(repo.id)}
                              disabled={comp?.status !== 'behind_safe'}
                              className={`p-1.5 rounded-lg transition ${
                                comp?.status === 'behind_safe'
                                  ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 font-bold'
                                  : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              }`}
                              title="立即同步"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedRepoId(repo.id)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="设置详情"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteRepo(repo)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                            title="从系统中移除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedRepoId && (
        <RepoDetailPage
          repoId={selectedRepoId}
          onClose={() => setSelectedRepoId(null)}
          onUpdated={() => {
            fetchRepos();
            onRefreshStats();
          }}
        />
      )}
    </div>
  );
};
