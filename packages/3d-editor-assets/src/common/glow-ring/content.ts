import { deepClone } from '../../utils/deep-clone'
import type { GlowRingContentJSON } from './types'

export function createDefaultContent(
  overrides?: Partial<GlowRingContentJSON>
): GlowRingContentJSON {
  return {
    radius: 2.5,
    bandWidth: 0.1,
    colorA: '#ffffff',
    colorB: '#38bdf8',
    highlightSpan: 0.22,
    highlightAngle: 2.2,
    intensity: 1.35,
    lift: 0.02,
    ...overrides
  }
}

export function cloneContent(content: GlowRingContentJSON): GlowRingContentJSON {
  return deepClone(content)
}

export function isContent(value: unknown): value is GlowRingContentJSON {
  if (!value || typeof value !== 'object') return false
  const v = value as GlowRingContentJSON
  return typeof v.radius === 'number' && typeof v.bandWidth === 'number'
}
