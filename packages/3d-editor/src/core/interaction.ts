import type { TransformMode } from './types'

export const GRID_SNAP_RULE_ID = 'core:grid-snap'
export const DEFAULT_GRID_SNAP_SIZE = 0.1
export const DEFAULT_TRANSLATION_SNAP = 0.1

const MODE_ORDER: TransformMode[] = ['translate', 'rotate', 'scale']

/** 去重并保序；空数组回退为 translate */
export function normalizeTransformModes(modes: TransformMode[] | undefined): TransformMode[] {
  const seen = new Set<TransformMode>()
  const next: TransformMode[] = []
  for (const mode of modes ?? ['translate']) {
    if (!MODE_ORDER.includes(mode) || seen.has(mode)) continue
    seen.add(mode)
    next.push(mode)
  }
  return next.length ? next : ['translate']
}

export function pickTransformMode(
  modes: TransformMode[],
  preferred: TransformMode | undefined
): TransformMode {
  if (preferred && modes.includes(preferred)) return preferred
  return modes[0] ?? 'translate'
}

export function modesIncludeScale(modes: TransformMode[]): boolean {
  return modes.includes('scale')
}
