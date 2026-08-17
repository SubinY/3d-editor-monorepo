import { describe, expect, it, vi } from 'vitest'
import { createCompositeDataSource, createDataSource, parseSamplesPayload } from '../data-source'
import { evaluateHighlight, PointValueStore } from '../evaluate'
import {
  createTwinPoint,
  createTwinRule,
  emptyTwin,
  readTwin,
  resolveTwinId,
  writeTwin
} from '../twin-props'
import { TwinPlayer } from '../twin-player'
import type { DataSource, DataSourceNeed, PointSample, TwinDocument, TwinDocumentNode, TwinViewport } from '../types'

/** 测试用推送源 */
class FakeDataSource implements DataSource {
  private listeners = new Set<(samples: PointSample[]) => void>()
  need: DataSourceNeed[] = []

  start(need: DataSourceNeed[]): void {
    this.need = need.map(n => ({ ...n }))
  }

  stop(): void {
    this.need = []
  }

  subscribe(onBatch: (samples: PointSample[]) => void): () => void {
    this.listeners.add(onBatch)
    return () => {
      this.listeners.delete(onBatch)
    }
  }

  emit(samples: PointSample[]): void {
    for (const listener of this.listeners) listener(samples)
  }
}

function makeDoc(nodes: TwinDocumentNode[]): TwinDocument {
  const map = new Map(nodes.map(n => [n.id, n]))
  return {
    getNodes: () => nodes,
    getNode: id => map.get(id),
    commands: {
      updateNode: (id, patch) => {
        const node = map.get(id)
        if (!node) return
        node.props = { ...(node.props ?? {}), ...(patch.props ?? {}) }
      }
    }
  }
}

describe('readTwin / writeTwin', () => {
  it('emptyTwin 默认无点位规则', () => {
    expect(emptyTwin()).toEqual({ points: [], rules: [] })
  })

  it('读 props.twin', () => {
    const node: TwinDocumentNode = {
      id: 'n1',
      props: {
        twin: {
          id: '柜A',
          points: [{ key: 'temp', alias: '柜温' }],
          rules: [
            {
              id: 'r1',
              when: { point: 'temp', op: 'gt', value: 60 },
              then: { slots: { highlight: 'fault' } }
            }
          ]
        }
      }
    }
    const twin = readTwin(node)
    expect(twin.id).toBe('柜A')
    expect(twin.points[0].key).toBe('temp')
    expect(twin.rules?.[0].then.slots.highlight).toBe('fault')
  })

  it('无 twin 返回 emptyTwin，不读 bindings/events', () => {
    const node: TwinDocumentNode = {
      id: 'n1',
      props: {
        bindings: [{ id: 'pt1', key: 'temp', alias: '柜温' }],
        events: [
          {
            id: 'ev1',
            when: { pointKey: 'temp', op: 'gt', value: 80 },
            then: { highlight: 'fault' }
          }
        ]
      }
    }
    expect(readTwin(node)).toEqual({ points: [], rules: [] })
  })

  it('writeTwin 写出 twin 并保留其它 props', () => {
    const node: TwinDocumentNode = {
      id: 'n1',
      props: {
        circuit: 'L-1'
      }
    }
    const doc = makeDoc([node])
    writeTwin(doc, 'n1', {
      points: [createTwinPoint('alarm', { alias: '告警' })],
      rules: [
        createTwinRule({
          when: { point: 'alarm', op: 'eq', value: 1 },
          then: { slots: { highlight: 'warning' } }
        })
      ]
    })
    expect(node.props?.circuit).toBe('L-1')
    expect((node.props?.twin as { points: unknown[] }).points[0]).toMatchObject({
      key: 'alarm',
      alias: '告警'
    })
  })

  it('resolveTwinId 优先 twin.id', () => {
    const node: TwinDocumentNode = { id: 'node-uuid', props: { twin: { id: 'C-01', points: [] } } }
    expect(resolveTwinId(node)).toBe('C-01')
    expect(resolveTwinId({ id: 'node-uuid', props: {} })).toBe('node-uuid')
  })
})

describe('evaluateHighlight', () => {
  it('无规则或未命中返回 null', () => {
    expect(evaluateHighlight({ points: [{ key: 'temp' }], rules: [] }, { temp: 90 })).toBeNull()
    expect(
      evaluateHighlight(
        {
          points: [{ key: 'temp' }],
          rules: [
            createTwinRule({
              when: { point: 'temp', op: 'gt', value: 100 },
              then: { slots: { highlight: 'fault' } }
            })
          ]
        },
        { temp: 50 }
      )
    ).toBeNull()
  })

  it('未声明的 point 不参与求值', () => {
    expect(
      evaluateHighlight(
        {
          points: [],
          rules: [
            createTwinRule({
              when: { point: 'temp', op: 'gt', value: 0 },
              then: { slots: { highlight: 'fault' } }
            })
          ]
        },
        { temp: 99 }
      )
    ).toBeNull()
  })

  it('多命中取严重度更高的 highlight', () => {
    const effect = evaluateHighlight(
      {
        points: [{ key: 'temp' }, { key: 'alarm' }],
        rules: [
          createTwinRule({
            when: { point: 'temp', op: 'gt', value: 40 },
            then: { slots: { highlight: 'warning' } }
          }),
          createTwinRule({
            when: { point: 'alarm', op: 'eq', value: 1 },
            then: { slots: { highlight: 'fault' } }
          })
        ]
      },
      { temp: 50, alarm: 1 }
    )
    expect(effect).toBe('fault')
  })
})

describe('PointValueStore twinId 隔离', () => {
  it('同 key 不同 twin 互不影响', () => {
    const store = new PointValueStore()
    store.set('A', 'temp', 30)
    store.set('B', 'temp', 90)
    expect(store.get('A', 'temp')).toBe(30)
    expect(store.get('B', 'temp')).toBe(90)
  })
})

describe('parseSamplesPayload / createDataSource', () => {
  it('解析合法 samples，忽略坏项', () => {
    expect(
      parseSamplesPayload({
        samples: [
          { twinId: 'A', key: 'temp', value: 30 },
          { twinId: 'B', key: 'temp', value: { bad: true } },
          { twinId: 1, key: 'x', value: 1 }
        ]
      })
    ).toEqual([{ twinId: 'A', key: 'temp', value: 30 }])
  })

  it('mapResponse 可将 dataId 列表转为 samples', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { dataId: 'temp', value: 27 },
        { dataId: 'alarm', value: 1 }
      ]
    })
    vi.stubGlobal('fetch', fetchMock)

    const source = createDataSource({
      type: 'http',
      url: '/api/x',
      method: 'POST',
      intervalMs: 1000,
      mapResponse: (raw, ctx) => {
        if (!Array.isArray(raw)) return raw
        return {
          samples: raw.map((row: { dataId: string; value: unknown }) => {
            const hit = ctx.need.find(n => n.key === row.dataId)
            return {
              twinId: hit?.twinId ?? 'unknown',
              key: row.dataId,
              value: row.value
            }
          })
        }
      }
    })
    const batches: PointSample[][] = []
    source.subscribe(s => batches.push(s))
    source.start([
      { twinId: 'cab-1', key: 'temp' },
      { twinId: 'cab-1', key: 'alarm' }
    ])
    await vi.advanceTimersByTimeAsync(0)
    expect(batches[0]).toEqual([
      { twinId: 'cab-1', key: 'temp', value: 27 },
      { twinId: 'cab-1', key: 'alarm', value: 1 }
    ])
    source.stop()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('createDataSource(http) 按 need POST 并推样本', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        samples: [
          { twinId: 'A', key: 'temp', value: 42 },
          { twinId: 'B', key: 'temp', value: 43 }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const source = createDataSource({
      type: 'http',
      url: '/api/twin/points',
      method: 'POST',
      intervalMs: 1000
    })
    const batches: PointSample[][] = []
    source.subscribe(s => batches.push(s))
    source.start([
      { twinId: 'A', key: 'temp' },
      { twinId: 'B', key: 'temp' }
    ])

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalled()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      need: [
        { twinId: 'A', key: 'temp' },
        { twinId: 'B', key: 'temp' }
      ]
    })
    expect(batches[0]).toEqual([
      { twinId: 'A', key: 'temp', value: 42 },
      { twinId: 'B', key: 'temp', value: 43 }
    ])

    source.stop()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})

describe('createCompositeDataSource', () => {
  it('合并两路源的样本并转发 start need', () => {
    const a = new FakeDataSource()
    const b = new FakeDataSource()
    const composite = createCompositeDataSource([a, b])
    const batches: PointSample[][] = []
    composite.subscribe(s => batches.push(s))
    composite.start([{ twinId: 'X', key: 'temp' }])
    expect(a.need).toEqual([{ twinId: 'X', key: 'temp' }])
    expect(b.need).toEqual([{ twinId: 'X', key: 'temp' }])
    a.emit([{ twinId: 'X', key: 'temp', value: 1 }])
    b.emit([{ twinId: 'X', key: 'alarm', value: 0 }])
    expect(batches).toEqual([
      [{ twinId: 'X', key: 'temp', value: 1 }],
      [{ twinId: 'X', key: 'alarm', value: 0 }]
    ])
    composite.stop()
    expect(a.need).toEqual([])
    expect(b.need).toEqual([])
  })

  it('空列表返回可安全 start 的空源', () => {
    const empty = createCompositeDataSource([])
    expect(() => empty.start([{ twinId: 'A', key: 'temp' }])).not.toThrow()
    empty.stop()
  })
})

describe('TwinPlayer', () => {
  it('收集目标时 twin.id 回落到 node.id', async () => {
    const node: TwinDocumentNode = {
      id: 'door-1',
      props: {
        twin: {
          points: [{ key: 'temp' }],
          rules: [
            {
              id: 'r1',
              when: { point: 'temp', op: 'gt', value: 60 },
              then: { slots: { highlight: 'fault' } }
            }
          ]
        }
      }
    }
    const viewport: TwinViewport = {
      setNodeVisualState: () => undefined,
      clearVisualStates: () => undefined
    }
    const player = new TwinPlayer({
      document: makeDoc([node]),
      viewport,
      source: new FakeDataSource(),
      mapHighlight: () => ({ color: null })
    })
    await player.start()
    expect(player.getTargets()[0]).toMatchObject({
      twinId: 'door-1',
      twin: { id: 'door-1' }
    })
    player.stop()
  })

  it('无规则不刷色；命中后 setNodeVisualState', async () => {
    const painted: Array<{ path: string; color: string | null | undefined }> = []
    const viewport: TwinViewport = {
      setNodeVisualState: (path, state) => {
        painted.push({ path, color: state.color })
      },
      clearVisualStates: () => {
        painted.length = 0
      }
    }

    const withRule: TwinDocumentNode = {
      id: 'cab-1',
      name: '一号柜',
      props: {
        twin: {
          points: [{ key: 'temp' }],
          rules: [
            {
              id: 'r1',
              when: { point: 'temp', op: 'gt', value: 60 },
              then: { slots: { highlight: 'fault' } }
            }
          ]
        }
      }
    }
    const noRule: TwinDocumentNode = {
      id: 'cab-2',
      props: { twin: { points: [{ key: 'temp' }] } }
    }
    const doc = makeDoc([withRule, noRule])
    const source = new FakeDataSource()
    const player = new TwinPlayer({
      document: doc,
      viewport,
      source,
      mapHighlight: effect => (effect === 'fault' ? { color: '#ff0000', intensity: 1 } : { color: null })
    })

    await player.start()
    expect(player.getTargets()).toHaveLength(1)
    expect(player.getTargets()[0].path).toBe('cab-1')

    painted.length = 0
    player.applyAndPaint([
      { twinId: 'cab-1', key: 'temp', value: 90 },
      { twinId: 'cab-2', key: 'temp', value: 90 }
    ])
    expect(painted.some(p => p.path === 'cab-1' && p.color === '#ff0000')).toBe(true)
    expect(painted.some(p => p.path === 'cab-2')).toBe(false)

    player.stop()
  })
})
