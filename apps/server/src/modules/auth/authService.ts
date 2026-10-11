import { createOctokitClient } from '../github/client.js';
import { encryptSecret, maskToken } from '../security/crypto.js';
import { saveAccount, getAccount, deleteAccount } from '../storage/db.js';
import { logger } from '../logging/logger.js';
import type { AccountInfo } from '@gitforksync/shared';

export async function connectAccount(rawToken: string): Promise<AccountInfo> {
  const token = rawToken.trim();
  logger.info('Auth', 'Verifying GitHub Token connection...');

  const octokit = createOctokitClient(token);

  let userResponse;
  try {
    userResponse = await octokit.rest.users.getAuthenticated();
  } catch (err: any) {
    logger.error('Auth', 'GitHub Token 验证失败', { details: err.message });
    throw new Error(`GitHub 认证失败: ${err.message || '无效的 Token 或网络错误'}`);
  }

  const user = userResponse.data;
  let hasRepoAccess = true;
  let hasWriteAccess = true;

  try {
    // Check if token can list repos
    const reposRes = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 5,
      affiliation: 'owner',
    });
    if (reposRes.data.length > 0) {
      const firstRepo = reposRes.data[0];
      // Check permissions if available
      if (firstRepo.permissions) {
        hasWriteAccess = Boolean(firstRepo.permissions.push || firstRepo.permissions.admin);
      }
    }
  } catch (err: any) {
    logger.warn('Auth', '读取仓库列表权限不足', { details: err.message });
    hasRepoAccess = false;
    hasWriteAccess = false;
  }

  const encryptedToken = encryptSecret(token);
  const tokenHint = maskToken(token);

  await saveAccount({
    githubId: user.id,
    login: user.login,
    name: user.name || null,
    avatarUrl: user.avatar_url,
    authStatus: 'connected',
    encryptedToken,
    tokenHint,
    hasRepoAccess,
    hasWriteAccess,
  });

  logger.info('Auth', `GitHub 账号连接成功: ${user.login} (${user.id})`);

  return {
    githubId: user.id,
    login: user.login,
    name: user.name || null,
    avatarUrl: user.avatar_url,
    authStatus: 'connected',
    tokenHint,
    hasRepoAccess,
    hasWriteAccess,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAccountStatus(): Promise<AccountInfo | null> {
  const { account } = await getAccount();
  return account;
}

export async function disconnectAccount(): Promise<void> {
  logger.info('Auth', 'Disconnecting GitHub account...');
  await deleteAccount();
}
