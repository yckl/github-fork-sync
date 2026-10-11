import React, { useState } from 'react';
import {
  GitFork,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FolderGit2,
} from 'lucide-react';
import { api } from '../api/client.js';
import type { AccountInfo } from '@gitforksync/shared';

interface WizardPageProps {
  onComplete: (account: AccountInfo) => void;
}

export const WizardPage: React.FC<WizardPageProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [discoveryStats, setDiscoveryStats] = useState<{
    totalScanned: number;
    forksCount: number;
    regularCount: number;
    archivedCount: number;
  } | null>(null);

  const [defaultMode, setDefaultMode] = useState<'mode_a' | 'mode_b' | 'mode_c'>('mode_a');
  const [defaultBranch, setDefaultBranch] = useState<string>('upstream-sync');

  // Step 2 -> Connect Token
  const handleConnect = async () => {
    if (!token.trim()) {
      setError('请输入 GitHub Personal Access Token');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.connectAccount(token.trim());
      setAccount(res.account);
      setStep(3); // Go to verification
    } catch (err: any) {
      setError(err.message || '连接失败，请检查 Token 格式或网络');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 -> Scan repos
  const handleScanRepos = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.discoverRepositories();
      setDiscoveryStats(res.result);
      setStep(4);
    } catch (err: any) {
      setError(err.message || '扫描仓库失败');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 -> Complete setup
  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.updateSettings({
        defaultSyncMode: defaultMode,
        defaultTargetBranch: defaultBranch,
      });
      if (account) {
        onComplete(account);
      }
    } catch (err: any) {
      setError(err.message || '保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/25">
            <GitFork className="w-7 h-7 stroke-[2.5]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          欢迎使用 GitHub Fork 自动同步管理器
        </h2>
        <p className="mt-1.5 text-center text-sm text-slate-500 dark:text-slate-400">
          全自动、高安全、可定制的 Windows 本地 Git 仓库同步系统
        </p>

        {/* Progress steps pill indicator */}
        <div className="mt-6 flex justify-center items-center space-x-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === i
                  ? 'w-10 bg-emerald-500'
                  : step > i
                  ? 'w-6 bg-emerald-200 dark:bg-emerald-800'
                  : 'w-4 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200/80 dark:border-slate-800 rounded-3xl">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* STEP 1: Welcome & Environment Overview */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>核心安全保障机制</span>
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>完全在 Windows 本地运行，无需云端中转服务器</li>
                  <li>敏感 Token 采用 AES-256-GCM 本地加密保存，永不返回浏览器</li>
                  <li>严格基于 Git 提交拓扑关系比较，拒绝覆盖个人分支</li>
                  <li>默认采用模式 A 同步到独立分支，零风险保留上游更新</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition"
                >
                  <span>开始连接 GitHub</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Configure GitHub Token */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  GitHub Personal Access Token (PAT)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxx 或 github_pat_xxxx"
                    className="block w-full pl-10 pr-3 py-2.5 sm:text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  推荐使用{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Fine-grained Personal Access Token
                  </span>
                  ，仅授予需要同步的仓库权限：
                  <br />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    - Repository permissions: Contents (Read and write), Metadata (Read-only)
                  </span>
                </p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  返回
                </button>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>验证并连接</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Verify Account & Scan Repositories */}
          {step === 3 && account && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-4">
                <img
                  src={account.avatarUrl}
                  alt={account.login}
                  className="w-12 h-12 rounded-full ring-2 ring-emerald-500/30"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{account.name || account.login}</span>
                    <span className="text-xs font-normal text-slate-500">(@{account.login})</span>
                  </h4>
                  <div className="mt-1 flex items-center space-x-3 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>认证有效 ({account.tokenHint})</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{account.hasWriteAccess ? '具备推送权限' : '只读权限'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleScanRepos}
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>扫描我的 Fork 仓库</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Choose Default Sync Mode & Finish */}
          {step === 4 && discoveryStats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {discoveryStats.forksCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">识别出的 Fork 仓库</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-200">
                    {discoveryStats.regularCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">个人自建仓库</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  默认同步模式策略
                </label>
                <div className="space-y-2.5">
                  <label
                    onClick={() => setDefaultMode('mode_a')}
                    className={`block p-3.5 rounded-2xl border cursor-pointer transition ${
                      defaultMode === 'mode_a'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mode"
                        checked={defaultMode === 'mode_a'}
                        onChange={() => setDefaultMode('mode_a')}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        模式 A：自动同步到独立分支（强烈推荐）
                      </span>
                    </div>
                    <p className="mt-1 ml-5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      同步到独立的 <span className="font-mono text-emerald-600 font-semibold">{defaultBranch}</span>{' '}
                      分支，完全不修改你的 main 分支，零风险保留上游最新代码快照。
                    </p>
                  </label>

                  <label
                    onClick={() => setDefaultMode('mode_b')}
                    className={`block p-3.5 rounded-2xl border cursor-pointer transition ${
                      defaultMode === 'mode_b'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mode"
                        checked={defaultMode === 'mode_b'}
                        onChange={() => setDefaultMode('mode_b')}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        模式 B：自动同步我的主分支（仅限严格快进）
                      </span>
                    </div>
                    <p className="mt-1 ml-5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      直接快进同步到 main 分支。如果 main 存在个人提交或分叉，将安全暂停并通知你。
                    </p>
                  </label>

                  <label
                    onClick={() => setDefaultMode('mode_c')}
                    className={`block p-3.5 rounded-2xl border cursor-pointer transition ${
                      defaultMode === 'mode_c'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mode"
                        checked={defaultMode === 'mode_c'}
                        onChange={() => setDefaultMode('mode_c')}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        模式 C：仅检测变动，不自动更新
                      </span>
                    </div>
                    <p className="mt-1 ml-5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      定时检测上游有无新提交并提示，由你手动在网页中点击按钮后再执行同步。
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>完成初始化，进入控制台</span>
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
