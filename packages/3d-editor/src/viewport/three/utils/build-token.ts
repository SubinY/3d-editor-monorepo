/** buildNode 异步竞态：同 id 递增 token，await 后比对决定是否丢弃 */

export function bumpBuildToken(tokens: Map<string, number>, id: string): number {
  const next = (tokens.get(id) ?? 0) + 1
  tokens.set(id, next)
  return next
}

export function isBuildStale(
  tokens: Map<string, number>,
  id: string,
  token: number,
  options: { disposed: boolean; nodeExists: boolean }
): boolean {
  return options.disposed || tokens.get(id) !== token || !options.nodeExists
}
