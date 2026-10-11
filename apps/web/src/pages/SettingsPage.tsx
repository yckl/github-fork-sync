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
} from 'lucide-react';
import type { AccountInfo, SystemSettings, SyncMode } from '@gitforksync/shared';
import { api } from '../api/client.js';

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
  const [message, setMessage] = useState<string | null>(null);

  // New Token reconnect state
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Form states
  const [defaultTargetBranch, setDefaultTargetBranch] = useState('upstream-sync');
  const [defaultCheckIntervalMinutes, setDefaultCheckIntervalMinutes] = useState(360);
  const [defaultSyncMode, setDefaultSyncMode] = useState<SyncMode>('mode_a');
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
      setMessage('系统配置已成功保存并立即生效');
    } catch (err: any) {
      setMessage(`保存配置失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReconnectToken = async () => {
    if (!newToken.trim()) return;
    setConnecting(true);
    setMessage(null);
    try {
      await api.connectAccount(newToken.trim());
      setMessage('GitHub Token 已成功更新并验证通过');
      setShowTokenInput(false);
      setNewToken('');
      onAccountUpdated();
    } catch (err: any) {
      setMessage(`更新 Token 失败: ${err.message}`);
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
      setMessage('配置已成功导出为 JSON (不含敏感 Token)');
    } catch (err: any) {
      setMessage(`导出失败: ${err.message}`);
    }
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.importSettings(parsed);
      setMessage(res.message);
      onAccountUpdated();
    } catch (err: any) {
      setMessage(`导入失败: ${err.message || '文件格式不正确'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <SettingsIcon className="w-5 h-5 text-emerald-500" />
          <span>系统与同步策略设置</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          管理 GitHub 凭据、默认同步规则、并发调度及系统配置导入导出
        </p>
      </div>

      {message && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            关闭
          </button>
        </div>
      )}

      {/* GitHub Account Management Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <User className="w-4 h-4 text-emerald-500" />
          <span>GitHub 账号与安全凭据</span>
        </h2>

        {account ? (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center space-x-3.5">
              <img
                src={account.avatarUrl}
                alt={account.login}
                className="w-12 h-12 rounded-full ring-2 ring-emerald-500/30"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {account.name || account.login}
                  <span className="text-xs text-slate-500 font-normal ml-1.5">(@{account.login})</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-2 font-mono">
                  <span>凭据掩码: {account.tokenHint}</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {account.hasWriteAccess ? '具备仓库推送权限' : '只读权限'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                更换 Token
              </button>
              <button
                onClick={onDisconnect}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-medium"
              >
                断开连接
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            未连接 GitHub 账号。请在下方输入 Token 完成绑定。
          </div>
        )}

        {showTokenInput && (
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              更新 GitHub Token (输入新的 Personal Access Token)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="ghp_xxxx 或 github_pat_xxxx"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleReconnectToken}
                disabled={connecting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
              >
                {connecting ? '验证中...' : '确认更新'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Strategy Defaults */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>默认同步与调度策略</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              默认同步目标分支名称
            </label>
            <input
              type="text"
              value={defaultTargetBranch}
              onChange={(e) => setDefaultTargetBranch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              新导入 Fork 仓库默认使用的目标分支 (推荐保持 upstream-sync)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              默认检查间隔 (分钟)
            </label>
            <input
              type="number"
              min="5"
              max="43200"
              value={defaultCheckIntervalMinutes}
              onChange={(e) => setDefaultCheckIntervalMinutes(parseInt(e.target.value, 10) || 360)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">默认 360 分钟 (6 小时) 执行一次全局上游更新检测</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            默认同步模式
          </label>
          <select
            value={defaultSyncMode}
            onChange={(e) => setDefaultSyncMode(e.target.value as any)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="mode_a">模式 A：自动同步到独立分支 (推荐，完全不影响个人分支)</option>
            <option value="mode_b">模式 B：自动同步主分支 (严格快进)</option>
            <option value="mode_c">模式 C：仅检测，手动更新</option>
          </select>
        </div>
      </div>

      {/* Concurrency and Local Startup Settings */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>并发管控与 Windows 运行配置</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              API 读取最大并发数
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxApiConcurrency}
              onChange={(e) => setMaxApiConcurrency(parseInt(e.target.value, 10) || 2)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">防止短时间内触发 GitHub 接口限流，默认 2</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Git 同步推送最大并发数
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={maxGitConcurrency}
              onChange={(e) => setMaxGitConcurrency(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">保证磁盘与网络稳定性，默认 1 (串行安全推送)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">启动时自动打开浏览器</div>
              <div className="text-[11px] text-slate-500">双击 start.bat 启动程序后自动调起默认浏览器</div>
            </div>
            <input
              type="checkbox"
              checked={autoOpenBrowser}
              onChange={(e) => setAutoOpenBrowser(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
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
              className="w-4 h-4 text-emerald-600 rounded"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? '保存中...' : '保存全局设置'}</span>
          </button>
        </div>
      </div>

      {/* Backup, Import & Export */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Download className="w-4 h-4 text-emerald-500" />
          <span>配置备份与数据迁移</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          导出所有已配置的监控仓库、分支与同步策略，导出的 JSON 文件绝不包含任何敏感 Token。可在其它电脑一键导入恢复。
        </p>

        <div className="flex items-center space-x-3 pt-1">
          <button
            onClick={handleExportConfig}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出配置 JSON</span>
          </button>

          <label className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>导入配置 JSON</span>
            <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
