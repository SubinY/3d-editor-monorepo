import { evaluateHighlightHit, PointValueStore, defaultRankHighlight } from './evaluate'
import { readTwin, resolveTwinId } from './twin-props'
import type {
  DataSource,
  DataSourceNeed,
  TwinDocument,
  TwinDocumentNode,
  TwinProps,
  TwinTarget,
  TwinViewport
} from './types'

export type VisualStateLike = {
  color?: string | null
  intensity?: number
  pulse?: boolean
  pulseHz?: number
}

/** 解析一层嵌套 document nodes（如柜内元件）；未实现则只扫顶层 */
export type ResolveNested = (
  node: TwinDocumentNode
) => Promise<TwinDocumentNode[] | undefined> | TwinDocumentNode[] | undefined

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
  /** 嵌套document节点时作为辅助函数使用；即使父节点无 twin，也扫一层子节点；path = `${parentId}/${childId}` */
  resolveNested?: ResolveNested
}

function hasPlayableRules(twin: TwinProps): boolean {
  return (twin.rules ?? []).some(r => r.enabled !== false && typeof r.then.slots.highlight === 'string')
}

function pushTarget(targets: TwinTarget[], node: TwinDocumentNode, path: string): void {
  const raw = readTwin(node)
  if (!hasPlayableRules(raw)) return
  const twinId = resolveTwinId(node, raw)
  targets.push({
    path,
    label: node.name ?? node.id,
    twinId,
    twin: { ...raw, id: twinId }
  })
}

/**
 * 收集可播目标（有 highlight 规则）。
 * 顶层 path = node.id；嵌套 path = `${parentId}/${childId}`（与视口 setNodeVisualState 一致）。
 * twinId = props.twin.id ?? node.id；写入 target.twin.id 便于调试/下游一致。
 */
export async function collectTwinTargets(
  doc: TwinDocument,
  resolveNested?: ResolveNested
): Promise<TwinTarget[]> {
  const targets: TwinTarget[] = []
  for (const node of doc.getNodes()) {
    pushTarget(targets, node, node.id)
    if (!resolveNested) continue
    const children = await resolveNested(node)
    if (!children) continue
    for (const child of children) {
      pushTarget(targets, child, `${node.id}/${child.id}`)
    }
  }
  return targets
}

/**
 * 从文档可播目标收集 `points[].source` 去重，供 Host 按需建连。
 * 无 source 的点位不计入。
 */
export async function collectUsedSourceIds(
  doc: TwinDocument,
  resolveNested?: ResolveNested
): Promise<string[]> {
  const targets = await collectTwinTargets(doc, resolveNested)
  const ids = new Set<string>()
  for (const t of targets) {
    for (const p of t.twin.points) {
      if (p.source) ids.add(p.source)
    }
  }
  return [...ids]
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
    this.targets = await collectTwinTargets(this.opts.document, this.opts.resolveNested)
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
      const hit = evaluateHighlightHit(target.twin, values, rank)
      const effect = hit?.effect ?? null
      const info = {
        path: target.path,
        label: target.label,
        effect,
        twinId: target.twinId
      }
      results.push(info)
      this.opts.onHighlight?.(info)
      if (!effect || effect === 'normal') continue
      const state = { ...this.opts.mapHighlight(effect) }
      const animation = hit?.slots.animation
      if (animation === 'blink') state.pulse = true
      else if (animation === 'constant') state.pulse = false
      this.opts.viewport.setNodeVisualState(target.path, state)
      nextPainted.add(target.path)
    }
    this.painted = nextPainted
    this.opts.onPaint?.(results)
  }
}
