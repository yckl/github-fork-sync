import type {
  AccountInfo,
  DashboardStats,
  RepositoryItem,
  SyncConfig,
  JobRecord,
  SystemSettings,
  LogItem,
  CheckRunRecord,
  SyncRunRecord,
} from '@gitforksync/shared';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  let body = options?.body;

  if (body) {
    headers['Content-Type'] = 'application/json';
  } else if (options?.method === 'POST' || options?.method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
    body = '{}';
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    body,
    headers: {
      ...headers,
      ...(options?.headers as any || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `请求失败 (${res.status})`);
  }
  return data;
}

export const api = {
  // Auth
  getAuthStatus: async (): Promise<{ account: AccountInfo | null }> => {
    return fetchJson<{ account: AccountInfo | null }>('/auth/status');
  },
  connectAccount: async (token: string): Promise<{ account: AccountInfo }> => {
    return fetchJson<{ account: AccountInfo }>('/auth/connect', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  disconnectAccount: async (): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>('/auth/disconnect', { method: 'POST' });
  },

  // Dashboard
  getDashboard: async (): Promise<{ stats: DashboardStats }> => {
    return fetchJson<{ stats: DashboardStats }>('/dashboard');
  },

  // Repositories
  getRepositories: async (params?: {
    search?: string;
    isFork?: boolean;
    monitoredOnly?: boolean;
    status?: string;
  }): Promise<{ repos: RepositoryItem[] }> => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.isFork !== undefined) sp.set('isFork', String(params.isFork));
    if (params?.monitoredOnly) sp.set('monitoredOnly', 'true');
    if (params?.status) sp.set('status', params.status);
    const qs = sp.toString();
    return fetchJson<{ repos: RepositoryItem[] }>(`/repositories${qs ? `?${qs}` : ''}`);
  },
  discoverRepositories: async (): Promise<{
    result: { totalScanned: number; forksCount: number; regularCount: number; archivedCount: number };
  }> => {
    return fetchJson<{
      result: { totalScanned: number; forksCount: number; regularCount: number; archivedCount: number };
    }>('/repositories/discover', { method: 'POST' });
  },
  getRepositoryDetails: async (
    id: number
  ): Promise<{
    repo: RepositoryItem;
    history: { checkRuns: CheckRunRecord[]; syncRuns: SyncRunRecord[] };
  }> => {
    return fetchJson<{
      repo: RepositoryItem;
      history: { checkRuns: CheckRunRecord[]; syncRuns: SyncRunRecord[] };
    }>(`/repositories/${id}`);
  },
  updateRepoConfig: async (id: number, config: Partial<SyncConfig>): Promise<{ repo: RepositoryItem }> => {
    return fetchJson<{ repo: RepositoryItem }>(`/repositories/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  },
  checkRepo: async (id: number): Promise<{ jobId: string; message: string }> => {
    return fetchJson<{ jobId: string; message: string }>(`/repositories/${id}/check`, { method: 'POST' });
  },
  syncRepo: async (id: number): Promise<{ jobId: string; message: string }> => {
    return fetchJson<{ jobId: string; message: string }>(`/repositories/${id}/sync`, { method: 'POST' });
  },
  batchMonitor: async (repoIds: number[], enabled: boolean): Promise<{ count: number }> => {
    return fetchJson<{ count: number }>('/repositories/batch-monitor', {
      method: 'POST',
      body: JSON.stringify({ repoIds, enabled }),
    });
  },
  batchSyncMode: async (repoIds: number[], syncMode: string): Promise<{ count: number }> => {
    return fetchJson<{ count: number }>('/repositories/batch-sync-mode', {
      method: 'POST',
      body: JSON.stringify({ repoIds, syncMode }),
    });
  },

  // Jobs
  getJobs: async (): Promise<{
    jobs: JobRecord[];
    queueStatus: { queuedCount: number; activeApiTasks: number; activeGitTasks: number };
  }> => {
    return fetchJson<{
      jobs: JobRecord[];
      queueStatus: { queuedCount: number; activeApiTasks: number; activeGitTasks: number };
    }>('/jobs');
  },
  checkAllJobs: async (): Promise<{ count: number; message: string }> => {
    return fetchJson<{ count: number; message: string }>('/jobs/check-all', { method: 'POST' });
  },
  syncSelectedJobs: async (repoIds: number[]): Promise<{ count: number; message: string }> => {
    return fetchJson<{ count: number; message: string }>('/jobs/sync-selected', {
      method: 'POST',
      body: JSON.stringify({ repoIds }),
    });
  },

  // Settings
  getSettings: async (): Promise<{ settings: SystemSettings }> => {
    return fetchJson<{ settings: SystemSettings }>('/settings');
  },
  updateSettings: async (settings: Partial<SystemSettings>): Promise<{ settings: SystemSettings }> => {
    return fetchJson<{ settings: SystemSettings }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },
  exportSettings: async (): Promise<any> => {
    return fetchJson<any>('/settings/export');
  },
  importSettings: async (data: any): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>('/settings/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Logs
  getLogs: async (params?: { level?: string; repoId?: number; search?: string; limit?: number }): Promise<{
    logs: LogItem[];
  }> => {
    const sp = new URLSearchParams();
    if (params?.level && params.level !== 'all') sp.set('level', params.level);
    if (params?.repoId) sp.set('repoId', String(params.repoId));
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return fetchJson<{ logs: LogItem[] }>(`/logs${qs ? `?${qs}` : ''}`);
  },
};
