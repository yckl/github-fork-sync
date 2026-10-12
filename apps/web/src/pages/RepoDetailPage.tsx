import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  GitCommit,
  Clock,
  Save,
  ShieldAlert,
  Trash2,
  FolderGit2,
} from 'lucide-react';
import type { RepositoryItem, SyncConfig, CheckRunRecord, SyncRunRecord, SyncMode } from '@gitforksync/shared';
import { api } from '../api/client.js';
import { SyncModeSelector } from '../components/SyncModeSelector.js';

interface RepoDetailPageProps {
  repoId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const RepoDetailPage: React.FC<RepoDetailPageProps> = ({ repoId, onClose, onUpdated }) => {
  const [repo, setRepo] = useState<RepositoryItem | null>(null);
  const [history, setHistory] = useState<{ checkRuns: CheckRunRecord[]; syncRuns: SyncRunRecord[] }>({
    checkRuns: [],
    syncRuns: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states
  const [upstreamRepo, setUpstreamRepo] = useState('');
  const [upstreamBranch, setUpstreamBranch] = useState('main');
  const [targetBranch, setTargetBranch] = useState('upstream-sync');
  const [syncMode, setSyncMode] = useState<SyncMode>('mode_a');
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(360);

  const [activeTab, setActiveTab] = useState<'config' | 'preview' | 'history'>('config');

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    api
      .getRepositoryDetails(repoId)
      .then((res) => {
        setRepo(res.repo);
        setHistory(res.history);
        if (res.repo.syncConfig) {
          setUpstreamRepo(res.repo.syncConfig.upstreamRepo);
          setUpstreamBranch(res.repo.syncConfig.upstreamBranch);
          setTargetBranch(res.repo.syncConfig.targetBranch);
          setSyncMode(res.repo.syncConfig.syncMode);
          setAutoCheckEnabled(res.repo.syncConfig.autoCheckEnabled);
          setAutoSyncEnabled(res.repo.syncConfig.autoSyncEnabled);
          setCheckIntervalMinutes(res.repo.syncConfig.checkIntervalMinutes);
        }
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [repoId]);

  if (!repoId) return null;

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateRepoConfig(repoId, {
        upstreamRepo,
        upstreamBranch,
        targetBranch,
        syncMode,
        autoCheckEnabled,
        autoSyncEnabled,
        checkIntervalMinutes,
      });
      setMessage('同步配置已保存');
      onUpdated();
    } catch (err: any) {
      setMessage(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const res = await api.checkRepo(repoId);
      setMessage(res.message);
      onUpdated();
    } catch (err: any) {
      setMessage(`检测失败: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await api.syncRepo(repoId);
      setMessage(res.message);
      onUpdated();
    } catch (err: any) {
      setMessage(`同步失败: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRepo = async () => {
    if (!repo) return;
    if (
      !window.confirm(
        `确定要从系统移除仓库「${repo.name}」吗？\n\n提示：仅从本地管理列表移除记录，不会在 GitHub 上删除任何远程代码。`
      )
    ) {
      return;
    }
    try {
      await api.deleteRepository(repo.id);
      onUpdated();
      onClose();
    } catch (err: any) {
      setMessage(`移除失败: ${err.message}`);
    }
  };

  const comp = repo?.latestComparison;
  const preview = comp?.commitPreview;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-end">
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 h-[92vh] sm:h-full shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
        {/* Mobile Drag Indicator Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate flex items-center space-x-2">
              <span>{repo?.fullName || '仓库详情'}</span>
              {repo?.htmlUrl && (
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-emerald-500"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              上游: {repo?.parentFullName || repo?.syncConfig?.upstreamRepo || '未指定'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 pt-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'config', label: '同步配置' },
            { id: 'preview', label: '提交差异预览' },
            { id: 'history', label: '运行记录' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                activeTab === t.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {message && (
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>{message}</span>
              <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                关闭
              </button>
            </div>
          )}

          {/* Self-owned repo notice */}
          {repo && !repo.isFork && !upstreamRepo && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <FolderGit2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>此项目为您的原生自建仓库（非 Fork）</span>
              </div>
              <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/90">
                该项目为原创或自建项目，默认无需从上游同步。如果您需要将某个外部开源仓库作为上游进行单向跟踪合并，可在下方手动填写上游仓库地址并保存。
              </p>
            </div>
          )}

          {/* Quick status bar */}
          {comp && !(!repo.isFork && !upstreamRepo) && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">当前分支状态</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    comp.status === 'up_to_date'
                      ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                      : comp.status === 'behind_safe'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : comp.status === 'diverged'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {comp.status === 'up_to_date' && '已是最新'}
                  {comp.status === 'behind_safe' && `安全落后 (可同步 +${comp.aheadBy})`}
                  {comp.status === 'diverged' && `分支分叉 (+${comp.aheadBy} / -${comp.behindBy})`}
                  {comp.status === 'ahead' && `我方领先 (+${comp.behindBy})`}
                  {comp.status === 'incompatible' && '历史不兼容'}
                  {comp.status === 'error' && '检查失败'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{comp.errorMessage || '状态检查完成'}</p>
              <div className="pt-2 flex items-center space-x-4 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>上游 SHA: {comp.upstreamSha?.slice(0, 7) || '未知'}</span>
                <span>目标 SHA: {comp.targetSha?.slice(0, 7) || '未知'}</span>
              </div>
            </div>
          )}

          {/* TAB 1: Config */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  上游仓库 (owner/repo)
                </label>
                <input
                  type="text"
                  value={upstreamRepo}
                  onChange={(e) => setUpstreamRepo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    上游分支
                  </label>
                  <input
                    type="text"
                    value={upstreamBranch}
                    onChange={(e) => setUpstreamBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    同步目标分支
                  </label>
                  <input
                    type="text"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  同步策略模式
                </label>
                <SyncModeSelector
                  value={syncMode}
                  onChange={(val) => setSyncMode(val)}
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">启用定时自动检测</div>
                    <div className="text-[11px] text-slate-500">定期检查上游是否有新提交</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoCheckEnabled}
                    onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">发现更新后立即同步</div>
                    <div className="text-[11px] text-slate-500">满足安全条件时自动发起 Git 推送</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  检测频率 (分钟)
                </label>
                <input
                  type="number"
                  min="5"
                  max="43200"
                  value={checkIntervalMinutes}
                  onChange={(e) => setCheckIntervalMinutes(parseInt(e.target.value, 10) || 360)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? '保存中...' : '保存配置'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Diff Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {preview ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">上游最新提交</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {preview.latestCommitTitle || '无提交标题'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      作者: {preview.latestCommitAuthor} • 时间: {preview.latestCommitDate}
                    </div>
                  </div>

                  {preview.compareUrl && (
                    <div className="pt-2">
                      <a
                        href={preview.compareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        <span>在 GitHub 查看完整 Commit 差异</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{preview.filesChanged}</div>
                      <div className="text-[10px] text-slate-400">变更文件</div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800">
                      <div className="font-bold text-emerald-600">{preview.filesAdded}</div>
                      <div className="text-[10px] text-emerald-600/70">新增文件</div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800">
                      <div className="font-bold text-rose-600">{preview.filesDeleted}</div>
                      <div className="text-[10px] text-rose-600/70">删除文件</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-400">
                  暂无提交预览。点击下方“立即检查”获取最新差异信息。
                </div>
              )}
            </div>
          )}

          {/* TAB 3: History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">最近检测记录</h4>
                <div className="space-y-2">
                  {history.checkRuns.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2">暂无检测记录</div>
                  ) : (
                    history.checkRuns.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {r.comparisonStatus === 'up_to_date' && '已是最新'}
                            {r.comparisonStatus === 'behind_safe' && `可同步 (+${r.aheadBy})`}
                            {r.comparisonStatus === 'diverged' && `分叉 (+${r.aheadBy} / -${r.behindBy})`}
                            {r.comparisonStatus === 'error' && '失败'}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-2">{r.summary || r.errorMessage}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(r.finishedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">最近同步记录</h4>
                <div className="space-y-2">
                  {history.syncRuns.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2">暂无同步记录</div>
                  ) : (
                    history.syncRuns.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span
                            className={`font-bold ${
                              s.status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {s.status === 'success' ? '同步成功' : '失败'}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-2">
                            {s.afterSha ? `SHA: ${s.afterSha.slice(0, 7)}` : s.gitError || '未验证'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(s.finishedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-wrap items-center justify-between gap-2.5 pb-6 sm:pb-4">
          <div className="flex items-center space-x-2 flex-1 sm:flex-initial">
            <button
              onClick={handleCheckNow}
              disabled={checking || (!repo?.isFork && !upstreamRepo)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex-1 sm:flex-initial"
              title={!repo?.isFork && !upstreamRepo ? '自建项目未配置上游，无需检测' : '立即检测'}
            >
              {checking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>立即检测</span>
            </button>
            <button
              onClick={handleDeleteRepo}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition flex-1 sm:flex-initial"
              title="从本地管理列表移除"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>从系统移除</span>
            </button>
          </div>

          <button
            onClick={handleSyncNow}
            disabled={syncing || (!repo?.isFork && !upstreamRepo)}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!repo?.isFork && !upstreamRepo ? '自建项目未配置上游，无需同步' : '立即发起同步'}
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>立即发起同步</span>
          </button>
        </div>
      </div>
    </div>
  );
};
