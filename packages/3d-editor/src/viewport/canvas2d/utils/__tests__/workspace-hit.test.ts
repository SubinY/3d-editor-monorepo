import { describe, expect, it } from 'vitest'
import {
  hitWorkspaceEdge,
  hitWorkspaceVertex,
  insertOutlineVertex
} from '../workspace-hit'

describe('hitWorkspaceVertex', () => {
  const workspaces = [
    {
      id: 'ws-a',
      outline: [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3]
      ] as [number, number][]
    }
  ]

  it('命中最近顶点', () => {
    const hit = hitWorkspaceVertex(workspaces, 0.05, 0.02, 40)
    expect(hit).toEqual({ workspaceId: 'ws-a', vertexIndex: 0 })
  })

  it('超出阈值则未命中', () => {
    const hit = hitWorkspaceVertex(workspaces, 1, 1, 40)
    expect(hit).toBeUndefined()
  })

  it('后添加工作区优先', () => {
    const list = [
      ...workspaces,
      {
        id: 'ws-b',
        outline: [
          [0, 0],
          [1, 0],
          [1, 1]
        ] as [number, number][]
      }
    ]
    const hit = hitWorkspaceVertex(list, 0.02, 0.02, 40)
    expect(hit).toEqual({ workspaceId: 'ws-b', vertexIndex: 0 })
  })
})

describe('hitWorkspaceEdge / insertOutlineVertex', () => {
  const outline: [number, number][] = [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3]
  ]

  it('命中底边中点附近', () => {
    const hit = hitWorkspaceEdge(outline, 2, 0.05, 40)
    expect(hit?.edgeIndex).toBe(0)
    expect(hit?.t).toBeCloseTo(0.5, 1)
    expect(hit?.point[0]).toBeCloseTo(2, 1)
  })

  it('过近端点不命中边', () => {
    const hit = hitWorkspaceEdge(outline, 0.02, 0.02, 40)
    expect(hit).toBeUndefined()
  })

  it('插入顶点落在指定边上', () => {
    const next = insertOutlineVertex(outline, 0, 0.5)
    expect(next).toHaveLength(5)
    expect(next[1]).toEqual([2, 0])
  })
})
