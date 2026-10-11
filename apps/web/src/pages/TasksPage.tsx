import React, { useState, useEffect } from 'react';
import {
  ListTodo,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import type { JobRecord } from '@gitforksync/shared';
import { api } from '../api/client.js';

export const TasksPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [queueStatus, setQueueStatus] = useState<{
    queuedCount: number;
    activeApiTasks: number;
    activeGitTasks: number;
  }>({ queuedCount: 0, activeApiTasks: 0, activeGitTasks: 0 });
  const [loading, setLoading] = useState(false);
  const [triggeringCheckAll, setTriggeringCheckAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await api.getJobs();
      setJobs(res.jobs);
      setQueueStatus(res.queueStatus);
    } catch (err: any) {
      // keep quiet on background poll
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll every 3 seconds for active tasks
    const timer = setInterval(fetchJobs, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckAll = async () => {
    setTriggeringCheckAll(true);
    setMessage(null);
    try {
      const res = await api.checkAllJobs();
      setMessage(res.message);
      fetchJobs();
    } catch (err: any) {
      setMessage(`触发失败: ${err.message}`);
    } finally {
      setTriggeringCheckAll(false);
    }
  };

  const runningJobs = jobs.filter((j) => j.status === 'running');
  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const finishedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Header & Queue Telemetry */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <ListTodo className="w-5 h-5 text-emerald-500" />
            <span>任务调度中心</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            实时查看后台检查队列、Git 同步进度及执行日志
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchJobs}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title="手动刷新"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCheckAll}
            disabled={triggeringCheckAll}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {triggeringCheckAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>全量扫描检测</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            关闭
          </button>
        </div>
      )}

      {/* Telemetry Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">排队等待</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {queueStatus.queuedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">就绪中的任务</div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">API 读取并发</span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {queueStatus.activeApiTasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">活跃检查通道</div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Git 推送通道</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
              <Play className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {queueStatus.activeGitTasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">活跃写入操作</div>
        </div>
      </div>

      {/* Running Tasks Section */}
      {runningJobs.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-emerald-500/40 shadow-sm shadow-emerald-500/10 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>正在执行的任务 ({runningJobs.length})</span>
          </h2>
          <div className="space-y-2.5">
            {runningJobs.map((j) => (
              <div
                key={j.id}
                className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {j.type.startsWith('sync') ? 'Git 同步推送' : '版本提交检查'}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{j.repoFullName || `Repo #${j.repoId}`}</span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>步骤: {j.currentStep || '执行中...'}</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  开始于: {j.startedAt ? new Date(j.startedAt).toLocaleTimeString() : '刚刚'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            任务历史队列 (最近 {finishedJobs.length + pendingJobs.length} 项)
          </h3>
          <span className="text-[11px] text-slate-400">每 3 秒自动刷新</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">任务类型</th>
                <th className="py-3 px-4">目标仓库</th>
                <th className="py-3 px-4">状态</th>
                <th className="py-3 px-4">执行详情 / 错误</th>
                <th className="py-3 px-4 text-right">时间戳</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    队列为空，暂无运行任务
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {job.type.startsWith('sync') ? 'Git 仓库同步' : '版本提交检测'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {job.repoFullName || (job.repoId ? `Repo #${job.repoId}` : '全局扫描')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          job.status === 'completed'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : job.status === 'running'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse'
                            : job.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-0.5" />}
                        {job.status === 'failed' && <XCircle className="w-3 h-3 mr-0.5" />}
                        {job.status === 'running' && <RefreshCw className="w-3 h-3 mr-0.5 animate-spin" />}
                        {job.status === 'pending' && <Clock className="w-3 h-3 mr-0.5" />}
                        <span>
                          {job.status === 'completed' && '已完成'}
                          {job.status === 'running' && '执行中'}
                          {job.status === 'pending' && '等待中'}
                          {job.status === 'failed' && '失败'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-xs">
                      {job.error ? (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">{job.error}</span>
                      ) : (
                        job.currentStep || '正常就绪'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[11px] text-slate-400">
                      {job.finishedAt
                        ? new Date(job.finishedAt).toLocaleTimeString()
                        : new Date(job.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
