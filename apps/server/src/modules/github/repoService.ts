import { getAuthenticatedOctokit } from './client.js';
import { upsertRepositories } from '../storage/db.js';
import { logger } from '../logging/logger.js';

export interface DiscoveryResult {
  totalScanned: number;
  forksCount: number;
  regularCount: number;
  archivedCount: number;
}

export async function discoverRepositories(): Promise<DiscoveryResult> {
  const octokit = await getAuthenticatedOctokit();
  if (!octokit) {
    throw new Error('未连接 GitHub 账号或 Token 无效');
  }

  logger.info('RepoDiscovery', 'Starting repository discovery from GitHub...');

  let page = 1;
  const perPage = 100;
  let allRepos: any[] = [];

  while (true) {
    logger.info('RepoDiscovery', `Fetching repositories page ${page}...`);
    const res = await octokit.rest.repos.listForAuthenticatedUser({
      affiliation: 'owner',
      per_page: perPage,
      page,
      sort: 'updated',
    });

    if (res.data.length === 0) {
      break;
    }

    allRepos.push(...res.data);
    if (res.data.length < perPage) {
      break;
    }
    page++;
    if (page > 20) {
      // Safety guard against infinite loop
      break;
    }
  }

  logger.info('RepoDiscovery', `Total raw repositories fetched: ${allRepos.length}`);

  let forksCount = 0;
  let regularCount = 0;
  let archivedCount = 0;

  const processedRepos: Array<{
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
  }> = [];

  for (const repo of allRepos) {
    if (repo.archived) {
      archivedCount++;
    }

    let isFork = Boolean(repo.fork);
    let parentRepoId: number | null = null;
    let parentFullName: string | null = null;
    let parentHtmlUrl: string | null = null;
    let parentDefaultBranch: string | null = null;

    if (isFork) {
      forksCount++;
      // To get parent details, we need repos.get for detailed fork hierarchy
      try {
        const detailRes = await octokit.rest.repos.get({
          owner: repo.owner.login,
          repo: repo.name,
        });

        if (detailRes.data.parent) {
          parentRepoId = detailRes.data.parent.id;
          parentFullName = detailRes.data.parent.full_name;
          parentHtmlUrl = detailRes.data.parent.html_url;
          parentDefaultBranch = detailRes.data.parent.default_branch;
        }
      } catch (err: any) {
        logger.warn('RepoDiscovery', `获取 Fork ${repo.full_name} 的上游信息失败: ${err.message}`);
      }
    } else {
      regularCount++;
    }

    processedRepos.push({
      id: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      isFork,
      isPrivate: Boolean(repo.private),
      isArchived: Boolean(repo.archived),
      defaultBranch: repo.default_branch || 'main',
      parentRepoId,
      parentFullName,
      parentHtmlUrl,
      parentDefaultBranch,
    });
  }

  await upsertRepositories(processedRepos);
  logger.info('RepoDiscovery', `Discovery complete. Fork: ${forksCount}, 自建: ${regularCount}, 归档: ${archivedCount}`);

  return {
    totalScanned: allRepos.length,
    forksCount,
    regularCount,
    archivedCount,
  };
}
