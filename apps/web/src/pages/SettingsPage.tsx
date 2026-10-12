import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Download,
  Upload,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Folder,
  Layers,
  Key,
  ChevronDown,
  Sparkles,
  GitBranch,
  Cpu,
  Monitor,
} from 'lucide-react';
import type { AccountInfo, SystemSettings, SyncMode } from '@gitforksync/shared';
import { api } from '../api/client.js';
import { SyncModeSelector } from '../components/SyncModeSelector.js';

interface SettingsPageProps {
  account: AccountInfo | null;
  onAccountUpdated: () => void;
  onDisconnect: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  account,
  onAccountUpdated,
  onDisconnect,
}) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingToAll, setApplyingToAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // New Token reconnect state
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Form states
  const [defaultTargetBranch, setDefaultTargetBranch] = useState('upstream-sync');
  const [defaultCheckIntervalMinutes, setDefaultCheckIntervalMinutes] = useState(360);
  const [defaultSyncMode, setDefaultSyncMode] = useState<SyncMode>('mode_b');
  const [maxApiConcurrency, setMaxApiConcurrency] = useState(2);
  const [maxGitConcurrency, setMaxGitConcurrency] = useState(1);
  const [autoOpenBrowser, setAutoOpenBrowser] = useState(true);
  const [autoStartOnBoot, setAutoStartOnBoot] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getSettings()
      .then((res) => {
        setSettings(res.settings);
        setDefaultTargetBranch(res.settings.defaultTargetBranch);
        setDefaultCheckIntervalMinutes(res.settings.defaultCheckIntervalMinutes);
        setDefaultSyncMode(res.settings.defaultSyncMode);
        setMaxApiConcurrency(res.settings.maxApiConcurrency);
        setMaxGitConcurrency(res.settings.maxGitConcurrency);
        setAutoOpenBrowser(res.settings.autoOpenBrowser);
        setAutoStartOnBoot(res.settings.autoStartOnBoot);
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({
        defaultTargetBranch,
        defaultCheckIntervalMinutes,
        defaultSyncMode,
        maxApiConcurrency,
        maxGitConcurrency,
        autoOpenBrowser,
        autoStartOnBoot,
      });
      setMessage('✅ 系统全局配置已成功保存并立即生效');
    } catch (err: any) {
      setMessage(`❌ 保存配置失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = async () => {
    setApplyingToAll(true);
    setMessage(null);
    try {
      const res = await api.applyDefaultsToAll();
      setMessage(`✅ ${res.message}`);
    } catch (err: any) {
      setMessage(`❌ 批量应用失败: ${err.message}`);
    } finally {
      setApplyingToAll(false);
    }
  };

  const handleReconnectToken = async () => {
    if (!newToken.trim()) return;
    setConnecting(true);
    setMessage(null);
    try {
      await api.connectAccount(newToken.trim());
      setMessage('✅ GitHub Token 已成功更新并验证通过');
      setShowTokenInput(false);
      setNewToken('');
      onAccountUpdated();
    } catch (err: any) {
      setMessage(`❌ 更新 Token 失败: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleExportConfig = async () => {
    try {
      const data = await api.exportSettings();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `git-fork-sync-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('✅ 配置已成功导出为 JSON (不含敏感 Token)');
    } catch (err: any) {
      setMessage(`❌ 导出失败: ${err.message}`);
    }
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.importSettings(parsed);
      setMessage(`✅ ${res.message}`);
      onAccountUpdated();
    } catch (err: any) {
      setMessage(`❌ 导入失败: ${err.message || '文件格式不正确'}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-2 space-y-6 pb-12">
      {/* Page Title Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <SettingsIcon className="w-5 h-5" />
            </span>
            <span>系统与同步策略设置</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 ml-1">
            管理 GitHub 凭据、默认同步规则、并发调度及系统配置导入导出
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? '保存中...' : '保存全局设置'}</span>
        </button>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between shadow-md animate-fade-in">
          <span>{message}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            关闭
          </button>
        </div>
      )}

      {/* GitHub Account Management Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center space-x-2.5 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <User className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">GitHub 账号与安全凭据</h2>
        </div>

        {account ? (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center space-x-4">
              <img
                src={account.avatarUrl}
                alt={account.login}
                className="w-12 h-12 rounded-full ring-2 ring-emerald-500/40 shadow-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2 flex-wrap">
                  <span className="truncate">{account.name || account.login}</span>
                  <span className="text-xs text-slate-500 font-normal">(@{account.login})</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2 font-mono flex-wrap">
                  <span>凭据掩码: {account.tokenHint}</span>
                  <span>•</span>
                  <span className="text-emerald-500 font-medium">
                    {account.hasWriteAccess ? '具备仓库推送权限' : '只读权限'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
              >
                更换 Token
              </button>
              <button
                onClick={onDisconnect}
                className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
              >
                断开连接
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            未连接 GitHub 账号。请在下方输入 Token 完成绑定。
          </div>
        )}

        {showTokenInput && (
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-emerald-500/30 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              更新 GitHub Token (Personal Access Token)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="ghp_xxxx 或 github_pat_xxxx"
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <button
                onClick={handleReconnectToken}
                disabled={connecting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                {connecting ? '验证中...' : '确认更新'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Strategy Defaults */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">默认同步与调度策略</h2>
          </div>

          <button
            onClick={handleApplyToAll}
            disabled={applyingToAll}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{applyingToAll ? '应用中...' : '一键将此策略应用至全部 Fork 仓库'}</span>
          </button>
        </div>

        {/* Modern Custom Dropdown Selector with Rich Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            默认同步策略模式
          </label>
          <SyncModeSelector
            value={defaultSyncMode}
            onChange={(val) => setDefaultSyncMode(val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              模式 A 默认目标分支名称
            </label>
            <input
              type="text"
              value={defaultTargetBranch}
              onChange={(e) => setDefaultTargetBranch(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              仅在模式 A 下使用（模式 B 将自动使用仓库主分支如 main）
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              默认自动检测间隔 (分钟)
            </label>
            <input
              type="number"
              min="5"
              max="43200"
              value={defaultCheckIntervalMinutes}
              onChange={(e) => setDefaultCheckIntervalMinutes(parseInt(e.target.value, 10) || 360)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">默认 360 分钟 (6 小时) 执行一次全局自动检测</p>
          </div>
        </div>
      </div>

      {/* Concurrency and Local Startup Settings */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center space-x-2.5 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Shield className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">并发管控与 Windows 运行配置</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              API 读取最大并发数
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxApiConcurrency}
              onChange={(e) => setMaxApiConcurrency(parseInt(e.target.value, 10) || 2)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">防止短时间内触发 GitHub 接口限流，默认 2</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Git 同步推送最大并发数
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={maxGitConcurrency}
              onChange={(e) => setMaxGitConcurrency(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">保证磁盘与网络稳定性，默认 1 (串行安全推送)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">启动时自动打开浏览器</div>
              <div className="text-[11px] text-slate-500">双击 start.bat 启动程序后自动调起默认浏览器访问网页</div>
            </div>
            <input
              type="checkbox"
              checked={autoOpenBrowser}
              onChange={(e) => setAutoOpenBrowser(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">开机自启记录标记</div>
              <div className="text-[11px] text-slate-500">可通过 Windows 任务计划程序配合 start.bat 实现</div>
            </div>
            <input
              type="checkbox"
              checked={autoStartOnBoot}
              onChange={(e) => setAutoStartOnBoot(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '保存中...' : '保存全部配置'}</span>
          </button>
        </div>
      </div>

      {/* Backup, Import & Export */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <Download className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">配置备份与数据迁移</h2>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          导出所有已配置的监控仓库、分支与同步策略，导出的 JSON 文件绝不包含任何敏感 Token。可在其它电脑一键导入恢复。
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportConfig}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出配置 JSON</span>
          </button>

          <label className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            <span>导入配置 JSON</span>
            <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
