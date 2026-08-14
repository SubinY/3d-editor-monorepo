import { describe, expect, it } from 'vitest'
import { bumpBuildToken, isBuildStale } from '../build-token'

describe('build-token', () => {
  it('bump 同 id 递增', () => {
    const tokens = new Map<string, number>()
    expect(bumpBuildToken(tokens, 'a')).toBe(1)
    expect(bumpBuildToken(tokens, 'a')).toBe(2)
    expect(bumpBuildToken(tokens, 'b')).toBe(1)
  })

  it('快速 add→remove：在途 build 的 token 失效', () => {
    const tokens = new Map<string, number>()
    const buildToken = bumpBuildToken(tokens, 'n1')
    // removeNodeObject 会再 bump，使在途 await 失效
    bumpBuildToken(tokens, 'n1')

    expect(
      isBuildStale(tokens, 'n1', buildToken, { disposed: false, nodeExists: false })
    ).toBe(true)
  })

  it('同 id 并发重建：旧 build 失效、新 build 有效', () => {
    const tokens = new Map<string, number>()
    const first = bumpBuildToken(tokens, 'n1')
    const second = bumpBuildToken(tokens, 'n1')

    expect(isBuildStale(tokens, 'n1', first, { disposed: false, nodeExists: true })).toBe(true)
    expect(isBuildStale(tokens, 'n1', second, { disposed: false, nodeExists: true })).toBe(false)
  })

  it('disposed 或节点已删均视为 stale', () => {
    const tokens = new Map<string, number>()
    const token = bumpBuildToken(tokens, 'n1')
    expect(isBuildStale(tokens, 'n1', token, { disposed: true, nodeExists: true })).toBe(true)
    expect(isBuildStale(tokens, 'n1', token, { disposed: false, nodeExists: false })).toBe(true)
  })
})
