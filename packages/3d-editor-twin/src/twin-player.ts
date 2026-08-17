import { evaluateHighlight, PointValueStore, defaultRankHighlight } from './evaluate'
import { readTwin, resolveTwinId } from './twin-props'
import type {
  DataSource,
  DataSourceNeed,
  TwinDocument,
  TwinProps,
  TwinTarget,
  TwinViewport
} from './types'

export type VisualStateLike = { color?: string | null; intensity?: number }

export interface TwinPlayerOptions {
  document: TwinDocument
  viewport: TwinViewport
  source: DataSource
  /** 效果令牌 → VisualState；Host 注入色板 */
  mapHighlight: (effect: string) => VisualStateLike
  /** 多规则冲突时排序；默认 soft convention */
  rankHighlight?: (effect: string) => number
  /** 每次刷色回调（告警日志等） */
  onHighlight?: (info: {
    path: string
    label: string
    effect: string | null
    twinId: string
  }) => void
  /** 一轮求值结束（便于汇总告警数） */
  onPaint?: (
    results: Array<{ path: string; label: string; effect: string | null; twinId: string }>
  ) => void
  /** 暂停时仍接收数据但不刷色 */
  getPaused?: () => boolean
}

function hasPlayableRules(twin: TwinProps): boolean {
  return (twin.rules ?? []).some(r => r.enabled !== false && typeof r.then.slots.highlight === 'string')
}

/**
 * 收集场景顶层可播目标（有 highlight 规则）。
 * twinId = props.twin.id ?? node.id；写入 target.twin.id 便于调试/下游一致。
 */
export function collectTwinTargets(doc: TwinDocument): TwinTarget[] {
  const targets: TwinTarget[] = []
  for (const node of doc.getNodes()) {
    const raw = readTwin(node)
    if (!hasPlayableRules(raw)) continue
    const twinId = resolveTwinId(node, raw)
    targets.push({
      path: node.id,
      label: node.name ?? node.id,
      twinId,
      twin: { ...raw, id: twinId }
    })
  }
  return targets
}

function buildNeed(targets: TwinTarget[]): DataSourceNeed[] {
  const seen = new Set<string>()
  const need: DataSourceNeed[] = []
  for (const t of targets) {
    for (const p of t.twin.points) {
      const id = `${t.twinId}\0${p.key}`
      if (seen.has(id)) continue
      seen.add(id)
      need.push({ twinId: t.twinId, key: p.key, source: p.source })
    }
  }
  return need
}

/**
 * 点值 → 求值 → highlight 槽 → setNodeVisualState。
 * 编辑态不必创建；预览/监控态 start/stop。
 */
export class TwinPlayer {
  private readonly store = new PointValueStore()
  private targets: TwinTarget[] = []
  private painted = new Set<string>()
  private unsub: (() => void) | undefined
  private started = false
  private readonly opts: TwinPlayerOptions

  constructor(options: TwinPlayerOptions) {
    this.opts = options
  }

  getStore(): PointValueStore {
    return this.store
  }

  getTargets(): TwinTarget[] {
    return this.targets
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    this.targets = collectTwinTargets(this.opts.document)
    const need = buildNeed(this.targets)
    this.unsub = this.opts.source.subscribe(samples => {
      this.store.applySamples(samples)
      this.paint()
    })
    this.opts.source.start(need)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.unsub?.()
    this.unsub = undefined
    this.opts.source.stop()
    this.clearPaint()
    this.store.clear()
    this.targets = []
  }

  /** 外部注入一批样本后立刻刷色（测试 / 自定义推送） */
  applyAndPaint(samples: Array<{ twinId: string; key: string; value: number | string | boolean }>): void {
    this.store.applySamples(samples)
    this.paint()
  }

  private clearPaint(): void {
    this.opts.viewport.clearVisualStates()
    this.painted.clear()
  }

  private paint(): void {
    if (this.opts.getPaused?.()) return
    const rank = this.opts.rankHighlight ?? defaultRankHighlight
    const nextPainted = new Set<string>()

    for (const path of this.painted) {
      this.opts.viewport.setNodeVisualState(path, { color: null })
    }

    const results: Array<{
      path: string
      label: string
      effect: string | null
      twinId: string
    }> = []

    for (const target of this.targets) {
      const values = this.store.getAllForTwin(target.twinId)
      const effect = evaluateHighlight(target.twin, values, rank)
      const info = {
        path: target.path,
        label: target.label,
        effect,
        twinId: target.twinId
      }
      results.push(info)
      this.opts.onHighlight?.(info)
      if (!effect || effect === 'normal') continue
      this.opts.viewport.setNodeVisualState(target.path, this.opts.mapHighlight(effect))
      nextPainted.add(target.path)
    }
    this.painted = nextPainted
    this.opts.onPaint?.(results)
  }
}
