import { Octokit } from '@octokit/rest';
import { logger } from '../logging/logger.js';
import { getAccount } from '../storage/db.js';
import { decryptSecret } from '../security/crypto.js';

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
}

let latestRateLimit: RateLimitStatus = {
  limit: 5000,
  remaining: 5000,
  reset: Math.floor(Date.now() / 1000) + 3600,
};

export function getLatestRateLimit(): RateLimitStatus {
  return { ...latestRateLimit };
}

export function updateRateLimitFromHeaders(headers: Record<string, any>) {
  if (headers['x-ratelimit-limit']) {
    latestRateLimit.limit = parseInt(headers['x-ratelimit-limit'], 10);
  }
  if (headers['x-ratelimit-remaining']) {
    latestRateLimit.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
  }
  if (headers['x-ratelimit-reset']) {
    latestRateLimit.reset = parseInt(headers['x-ratelimit-reset'], 10);
  }
}

export function createOctokitClient(token: string): Octokit {
  const octokit = new Octokit({
    auth: token,
    userAgent: 'GitForkSync/1.0',
    request: {
      timeout: 15000,
    },
  });

  octokit.hook.after('request', async (response) => {
    updateRateLimitFromHeaders(response.headers);
  });

  octokit.hook.error('request', async (error: any, options) => {
    if (error?.response?.headers) {
      updateRateLimitFromHeaders(error.response.headers);
    }
    const status = error?.status;
    if (status === 403 && error?.response?.headers?.['x-ratelimit-remaining'] === '0') {
      const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0', 10);
      logger.warn('GitHubClient', `GitHub API 限流已触发，重置时间: ${new Date(resetTime * 1000).toLocaleString()}`);
    }
    throw error;
  });

  return octokit;
}

export async function getAuthenticatedOctokit(): Promise<Octokit | null> {
  const { encryptedToken } = await getAccount();
  if (!encryptedToken) {
    return null;
  }
  try {
    const token = decryptSecret(encryptedToken);
    return createOctokitClient(token);
  } catch (err: any) {
    logger.error('GitHubClient', '解密 GitHub Token 失败', { details: err.message });
    return null;
  }
}
