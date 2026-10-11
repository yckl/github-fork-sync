import { describe, it, expect } from 'vitest';
import { evaluateBranchComparison } from '../src/modules/comparison/compareService.js';

describe('Branch Comparison Decision Engine (14.1)', () => {
  it('1. Upstream and Fork SHA identical -> up_to_date', () => {
    const sha = 'a1b2c3d4e5f678901234567890abcdef12345678';
    const result = evaluateBranchComparison({
      upstreamSha: sha,
      targetSha: sha,
      aheadBy: 0,
      behindBy: 0,
      hasCommonAncestor: true,
    });
    expect(result.status).toBe('up_to_date');
    expect(result.summary).toContain('SHA 完全一致');
  });

  it('2. Upstream ahead by 1 commit, no local commits -> behind_safe (auto-syncable)', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'upstream_new_sha_1',
      targetSha: 'my_old_sha_0',
      aheadBy: 1,
      behindBy: 0,
      hasCommonAncestor: true,
    });
    expect(result.status).toBe('behind_safe');
    expect(result.summary).toContain('安全快进同步');
  });

  it('3. Upstream ahead by 100 commits, no local commits -> behind_safe', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'upstream_new_sha_100',
      targetSha: 'my_old_sha_0',
      aheadBy: 100,
      behindBy: 0,
      hasCommonAncestor: true,
    });
    expect(result.status).toBe('behind_safe');
    expect(result.summary).toContain('100 个新提交');
  });

  it('4. Fork has local unique commits, upstream has 0 -> ahead (no-op)', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'upstream_sha_0',
      targetSha: 'my_sha_ahead_3',
      aheadBy: 0,
      behindBy: 3,
      hasCommonAncestor: true,
    });
    expect(result.status).toBe('ahead');
    expect(result.summary).toContain('我方领先');
  });

  it('5. Both sides have unique commits -> diverged (pause sync, manual check)', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'upstream_sha_new',
      targetSha: 'my_sha_custom',
      aheadBy: 5,
      behindBy: 2,
      hasCommonAncestor: true,
    });
    expect(result.status).toBe('diverged');
    expect(result.summary).toContain('分支已分叉');
  });

  it('6. No common ancestor -> incompatible', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'unrelated_upstream_sha',
      targetSha: 'unrelated_target_sha',
      aheadBy: 10,
      behindBy: 5,
      hasCommonAncestor: false,
    });
    expect(result.status).toBe('incompatible');
    expect(result.summary).toContain('不存在共同祖先');
  });

  it('7. Upstream has rewritten history / force push flagged -> unknown risk', () => {
    const result = evaluateBranchComparison({
      upstreamSha: 'force_pushed_sha',
      targetSha: 'target_sha',
      aheadBy: 1,
      behindBy: 0,
      hasCommonAncestor: true,
      isUpstreamRewritten: true,
    });
    expect(result.status).toBe('unknown');
    expect(result.summary).toContain('强制重写');
  });
});
