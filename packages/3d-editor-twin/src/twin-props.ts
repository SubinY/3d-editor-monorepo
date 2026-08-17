import type { TwinDocument, TwinDocumentNode, TwinPoint, TwinProps, TwinRule } from './types'

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyTwin(): TwinProps {
  return { points: [], rules: [] }
}

export function createTwinPoint(key: string, partial?: Partial<Omit<TwinPoint, 'key'>>): TwinPoint {
  return {
    key,
    source: partial?.source,
    alias: partial?.alias?.trim() || undefined,
    unit: partial?.unit
  }
}

export function createTwinRule(partial?: Partial<TwinRule>): TwinRule {
  return {
    id: partial?.id ?? createId('rule'),
    name: partial?.name,
    when: partial?.when ?? { point: 'temp', op: 'gt', value: 80 },
    then: partial?.then ?? { slots: { highlight: 'fault' } },
    enabled: partial?.enabled ?? true
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTwin(raw: unknown): TwinProps | null {
  if (!isRecord(raw)) return null
  const pointsRaw = Array.isArray(raw.points) ? raw.points : []
  const points: TwinPoint[] = []
  for (const p of pointsRaw) {
    if (!isRecord(p) || typeof p.key !== 'string') continue
    points.push({
      key: p.key,
      source: typeof p.source === 'string' ? p.source : undefined,
      alias: typeof p.alias === 'string' ? p.alias : undefined,
      unit: typeof p.unit === 'string' ? p.unit : undefined
    })
  }

  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : []
  const rules: TwinRule[] = []
  for (const r of rulesRaw) {
    if (!isRecord(r)) continue
    const when = isRecord(r.when) ? r.when : null
    const then = isRecord(r.then) ? r.then : null
    if (!when || typeof when.point !== 'string' || typeof when.op !== 'string') continue
    const slots = isRecord(then?.slots) ? { ...then.slots } : {}
    rules.push({
      id: typeof r.id === 'string' ? r.id : createId('rule'),
      name: typeof r.name === 'string' ? r.name : undefined,
      when: {
        point: when.point,
        op: when.op as TwinRule['when']['op'],
        value: when.value as number | string | boolean
      },
      then: { slots },
      enabled: r.enabled !== false
    })
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    points,
    rules
  }
}

/** 读 node.props.twin；无 twin 返回 emptyTwin() */
export function readTwin(node: TwinDocumentNode | undefined | null): TwinProps {
  const props = (node?.props ?? {}) as Record<string, unknown>
  return normalizeTwin(props.twin) ?? emptyTwin()
}

/** 解析 twin 主键：props.twin.id ?? node.id */
export function resolveTwinId(node: TwinDocumentNode, twin?: TwinProps): string {
  const t = twin ?? readTwin(node)
  return t.id?.trim() || node.id
}

/**
 * 写出 props.twin（全量替换 twin 字段）。
 * 经 doc.commands.updateNode，可撤销。
 */
export function writeTwin(doc: TwinDocument, nodeId: string, next: TwinProps): void {
  const node = doc.getNode(nodeId)
  if (!node) return
  const rest: Record<string, unknown> = { ...(node.props ?? {}) }
  delete rest.twin
  doc.commands.updateNode(nodeId, {
    props: {
      ...rest,
      twin: {
        ...(next.id?.trim() ? { id: next.id.trim() } : {}),
        points: next.points.map(p => ({
          key: p.key,
          ...(p.source ? { source: p.source } : {}),
          ...(p.alias ? { alias: p.alias } : {}),
          ...(p.unit ? { unit: p.unit } : {})
        })),
        ...(next.rules && next.rules.length
          ? {
              rules: next.rules.map(r => ({
                id: r.id,
                ...(r.name ? { name: r.name } : {}),
                when: { ...r.when },
                then: { slots: { ...r.then.slots } },
                enabled: r.enabled !== false
              }))
            }
          : {})
      }
    }
  })
}
