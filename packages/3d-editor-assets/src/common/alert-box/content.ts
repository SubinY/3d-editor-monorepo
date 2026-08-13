import { deepClone } from '../../utils/deep-clone'
import type { AlertBoxContentJSON } from './types'

export function createDefaultContent(
  overrides?: Partial<AlertBoxContentJSON>
): AlertBoxContentJSON {
  return {
    width: 1.2,
    depth: 1.2,
    height: 1.0,
    color: '#ff3b30',
    intensity: 1.4,
    fadePower: 1.6,
    ...overrides
  }
}

export function cloneContent(content: AlertBoxContentJSON): AlertBoxContentJSON {
  return deepClone(content)
}

export function isContent(value: unknown): value is AlertBoxContentJSON {
  if (!value || typeof value !== 'object') return false
  const v = value as AlertBoxContentJSON
  return (
    typeof v.width === 'number' &&
    typeof v.depth === 'number' &&
    typeof v.height === 'number'
  )
}
