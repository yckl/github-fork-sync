import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';
import type { JobRecord } from '@gitforksync/shared';

interface TaskProgressBannerProps {
  onRefresh?: () => void;
}

export const TaskProgressBanner: React.FC<TaskProgressBannerProps> = ({ onRefresh }) => {
  const [activeJobs, setActiveJobs] = useState<JobRecord[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<number>(0);
  const [totalBatchCount, setTotalBatchCount] = useState<number>(0);
  const [isFinishedBannerVisible, setIsFinishedBannerVisible] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState('');

  useEffect(() => {
    let timer: any = null;
    let isMounted = true;

    const checkJobs = async () => {
      try {
        const res = await api.getJobs();
        if (!isMounted) return;

        const jobs = res.jobs || [];
        const runningOrPending = jobs.filter(
          (j) => j.status === 'running' || j.status === 'pending'
        );

        if (runningOrPending.length > 0) {
          // Track batch
          const totalInBatch = Math.max(totalBatchCount, jobs.length);
          const completedCount = jobs.filter(
            (j) => j.status === 'completed' || j.status === 'failed'
          ).length;

          setTotalBatchCount(totalInBatch);
          setRecentCompleted(completedCount);
          setActiveJobs(runningOrPending);
          setIsFinishedBannerVisible(false);
        } else {
          // If we had active jobs and now none
          if (activeJobs.length > 0) {
            setFinishedSummary(`全部任务执行完成！共处理 ${jobs.length} 个任务。`);
            setIsFinishedBannerVisible(true);
            setActiveJobs([]);
            setTotalBatchCount(0);
            setRecentCompleted(0);
            onRefresh?.();
            setTimeout(() => {
              if (isMounted) setIsFinishedBannerVisible(false);
            }, 6000);
          }
        }
      } catch (e) {
        // Silent error
      }
    };

    checkJobs();
    timer = setInterval(checkJobs, 1500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [activeJobs.length, totalBatchCount, onRefresh]);

  if (activeJobs.length === 0 && !isFinishedBannerVisible) {
    return null;
  }

  if (isFinishedBannerVisible) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between animate-fade-in shadow-sm">
        <div className="flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs font-medium text-emerald-300">
            {finishedSummary || '批量任务执行完成！数据已更新。'}
          </div>
        </div>
        <button
          onClick={() => setIsFinishedBannerVisible(false)}
          className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition"
        >
          关闭
        </button>
      </div>
    );
  }

  const runningJob = activeJobs.find((j) => j.status === 'running') || activeJobs[0];
  const pendingCount = activeJobs.length;
  const total = Math.max(totalBatchCount, recentCompleted + pendingCount);
  const done = Math.max(0, total - pendingCount);
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isSync = runningJob?.type.includes('sync');

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-lg text-slate-100 space-y-3 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2.5">
          <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </span>
          <div>
            <div className="font-semibold text-white flex items-center space-x-2">
              <span>{isSync ? '正在执行 Git 同步推送...' : '正在执行上游版本检测...'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {done} / {total} ({percent}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5 truncate max-w-md">
              <span className="text-emerald-400 font-mono font-medium">
                {runningJob?.repoFullName || '准备中'}
              </span>
              <span>•</span>
              <span className="truncate">{runningJob?.currentStep || '排队等待调度...'}</span>
            </div>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-400 font-mono">
          <span>剩余 {pendingCount} 个任务排队中</span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-slate-700/50 p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]"
          style={{ width: `${Math.max(5, percent)}%` }}
        />
      </div>
    </div>
  );
};
