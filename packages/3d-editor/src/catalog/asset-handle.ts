/**
 * Procedural 资产挂在 Object3D.userData 上的统一句柄。
 * Viewport3D 在 props 变更时调用 apply；删除节点时优先 dispose。
 */
export const MH_ASSET_HANDLE_KEY = 'mhAssetHandle'

export interface AssetHandle {
  /** 传入当前 node.props；资产自行从中取内容字段 */
  apply(props: Record<string, unknown> | undefined): void | Promise<void>
  dispose?(): void
}

export function getAssetHandle(
  root: { userData: Record<string, unknown>; traverse: (cb: (obj: { userData: Record<string, unknown> }) => void) => void }
): AssetHandle | undefined {
  const direct = root.userData[MH_ASSET_HANDLE_KEY] as AssetHandle | undefined
  if (direct?.apply) return direct
  let found: AssetHandle | undefined
  root.traverse(obj => {
    if (found) return
    const h = obj.userData[MH_ASSET_HANDLE_KEY] as AssetHandle | undefined
    if (h?.apply) found = h
  })
  return found
}
