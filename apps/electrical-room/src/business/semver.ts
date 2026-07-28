/**
 * 轻量 semver 工具（Host 侧保存升版校验）。
 * 只支持 X.Y.Z 数字三段。
 */

export function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version)
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

export type SemverBump = 'patch' | 'minor' | 'major'

export function bumpSemver(version: string, bump: SemverBump): string {
  if (!isValidSemver(version)) return '1.0.0'
  const [maj, min, pat] = version.split('.').map(Number)
  if (bump === 'major') return `${maj + 1}.0.0`
  if (bump === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}`
}

export function assertNewerSemver(next: string, latest: string | undefined): void {
  if (!isValidSemver(next)) {
    throw new Error(`非法版本号：${next}`)
  }
  if (latest && compareSemver(next, latest) <= 0) {
    throw new Error(`新版本 ${next} 必须大于当前最新 ${latest}`)
  }
}
