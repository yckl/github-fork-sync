export type SyncMode = 'mode_a' | 'mode_b' | 'mode_c';

export type ComparisonStatus =
  | 'up_to_date'       // SHA 完全一致
  | 'behind_safe'      // 上游有新提交，我方无独立提交 (可自动同步)
  | 'ahead'            // 我方有独立提交，上游无新提交
  | 'diverged'         // 双方都有独立提交 (分支分叉)
  | 'incompatible'     // 没有共同祖先
  | 'self_owned'       // 自建项目 (无需同步)
  | 'skipped'          // 已跳过检测
  | 'unknown'          // 状态未知 / 强制推送
  | 'error';           // API 失败

export type AuthStatus = 'connected' | 'invalid_token' | 'disconnected' | 'rate_limited';

export interface AccountInfo {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  authStatus: AuthStatus;
  tokenHint: string;
  hasRepoAccess: boolean;
  hasWriteAccess: boolean;
  updatedAt: string;
}

export interface SyncConfig {
  repoId: number;
  upstreamRepo: string;
  upstreamBranch: string;
  targetBranch: string;
  syncMode: SyncMode;
  autoCheckEnabled: boolean;
  autoSyncEnabled: boolean;
  checkIntervalMinutes: number;
  lastSuccessSha: string | null;
  updatedAt: string;
}

export interface LatestComparison {
  status: ComparisonStatus;
  upstreamSha: string | null;
  targetSha: string | null;
  aheadBy: number;
  behindBy: number;
  commonAncestorSha: string | null;
  checkedAt: string | null;
  errorMessage: string | null;
  commitPreview?: {
    latestCommitTitle?: string;
    latestCommitAuthor?: string;
    latestCommitDate?: string;
    compareUrl?: string;
    filesChanged?: number;
    filesAdded?: number;
    filesDeleted?: number;
  };
}

export interface RepositoryItem {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  isFork: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  defaultBranch: string;
  parentRepoId: number | null;
  parentFullName: string | null;
  parentHtmlUrl: string | null;
  parentDefaultBranch: string | null;
  discoveredAt: string;
  syncConfig: SyncConfig | null;
  latestComparison: LatestComparison | null;
}

export interface CheckRunRecord {
  id: string;
  repoId: number;
  repoName?: string | null;
  repoFullName?: string | null;
  startedAt: string;
  finishedAt: string;
  upstreamSha: string | null;
  targetSha: string | null;
  comparisonStatus: ComparisonStatus;
  aheadBy: number;
  behindBy: number;
  summary: string | null;
  errorMessage: string | null;
}

export interface SyncRunRecord {
  id: string;
  repoId: number;
  repoName?: string | null;
  repoFullName?: string | null;
  syncMode: SyncMode;
  targetBranch: string;
  startedAt: string;
  finishedAt: string;
  beforeSha: string | null;
  targetSha: string;
  afterSha: string | null;
  status: 'success' | 'failed' | 'unverified';
  gitError: string | null;
  verificationResult: boolean;
}

export type JobType = 'check_single' | 'check_all' | 'sync_single' | 'sync_selected';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  type: JobType;
  repoId: number | null;
  repoFullName: string | null;
  status: JobStatus;
  attempts: number;
  priority: number;
  currentStep: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SystemSettings {
  defaultCheckIntervalMinutes: number;
  defaultTargetBranch: string;
  defaultSyncMode: SyncMode;
  maxApiConcurrency: number;
  maxGitConcurrency: number;
  logRetentionDays: number;
  autoStartOnBoot: boolean;
  autoOpenBrowser: boolean;
}

export interface DashboardStats {
  totalRepos: number;
  forkRepos: number;
  monitoredRepos: number;
  upToDateCount: number;
  pendingSyncCount: number;
  needsAttentionCount: number;
  failedSyncCount: number;
  runningJobsCount: number;
  apiRateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
  nextCheckTime: string | null;
  recentChecks: CheckRunRecord[];
  recentSyncs: SyncRunRecord[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogItem {
  id: number;
  timestamp: string;
  level: LogLevel;
  repoId: number | null;
  jobId: string | null;
  module: string;
  message: string;
  details?: string | null;
}
