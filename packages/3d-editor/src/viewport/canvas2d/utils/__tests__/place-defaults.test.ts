import { describe, expect, it } from 'vitest'
import type { CatalogItem } from '../../../../catalog/types'
import {
  defaultContainerBackZ,
  defaultSceneGroundY,
  enclosureShellThickness,
} from '../place-defaults'

const item = (depth: number): CatalogItem =>
  ({
    id: 'comp',
    version: '1.0.0',
    name: 't',
    kind: 'component',
    placeableIn: ['container'],
    footprint: { width: 0.1, depth, height: 0.2 },
  }) as CatalogItem

describe('place-defaults', () => {
  it('container Z sits against inner back face', () => {
    const bounds = { width: 0.8, depth: 0.6, height: 2 }
    const t = enclosureShellThickness(0.8, 2, 0.6)
    const d = 0.08
    const z = defaultContainerBackZ(bounds, item(d))
    // node center: back inner (-depth/2+t) + half item depth
    expect(z).toBeCloseTo(-0.6 / 2 + t + d / 2)
    // item back face ≈ inner back
    expect(z - d / 2).toBeCloseTo(-0.6 / 2 + t)
  })

  it('scene ground Y is 0 (mesh lifts by h/2)', () => {
    expect(defaultSceneGroundY(item(0.5))).toBe(0)
  })
})
