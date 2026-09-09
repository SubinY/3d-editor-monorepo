import type {
  BoundsJSON,
  DefaultViewJSON,
  DocumentKind,
  EnvironmentCeilingJSON,
  EnvironmentFloorJSON,
  EnvironmentJSON,
  EnvironmentWallJSON,
  LightJSON,
  TransformJSON,
  WorkspaceJSON
} from './types'
import { createId } from '../utils/id'

export function createDefaultTransform(): TransformJSON {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  }
}

export function cloneTransform(t: TransformJSON): TransformJSON {
  return {
    position: [...t.position],
    rotation: [...t.rotation],
    scale: [...t.scale]
  }
}

/** 按拓扑写出完整默认 environment（无场景级 floor/ceiling） */
export function createDefaultEnvironment(kind: DocumentKind, bounds: BoundsJSON): EnvironmentJSON {
  const { width, depth, height } = bounds
  const h = height ?? (kind === 'container' ? 2 : Math.max(width, depth) * 0.5)

  const lights: LightJSON[] =
    kind === 'container'
      ? [
          { type: 'ambient', color: '#ffffff', intensity: 0.75 },
          {
            type: 'directional',
            color: '#ffffff',
            intensity: 1.4,
            position: [width * 0.4, h * 1.2, depth * 1.5],
            castShadow: true
          }
        ]
      : [
          { type: 'ambient', color: '#ffffff', intensity: 0.75 },
          {
            type: 'directional',
            color: '#ffffff',
            intensity: 1.4,
            position: [
              width * 0.6,
              Math.max(h, Math.max(width, depth)) * 0.9,
              depth * 0.6
            ],
            castShadow: true
          }
        ]

  const defaultView: DefaultViewJSON =
    kind === 'container'
      ? {
          type: 'orbit',
          position: [0, h * 0.45, Math.max(depth, 0.6) * 8],
          target: [0, h * 0.45, 0],
          fov: 50,
          minDistance: 0.2,
          maxDistance: 200
        }
      : (() => {
          const d = Math.max(width, depth, 4)
          return {
            type: 'orbit' as const,
            position: [d * 0.65, d * 0.6, d * 0.95] as [number, number, number],
            target: [0, 0, 0] as [number, number, number],
            fov: 50,
            minDistance: 1,
            maxDistance: 500
          }
        })()

  return {
    background: { type: 'color', value: '#0c1420' },
    lights,
    shadows: { enabled: true, type: 'pcfsoft' },
    helpers: {
      grid: true,
      enclosure: kind === 'container' ? 'openBox' : 'none'
    },
    wall: createDefaultWall(),
    defaultView
  }
}

/** 工作区缺省地面 */
export function createDefaultFloor(_kind: DocumentKind = 'scene'): EnvironmentFloorJSON {
  return {
    visible: true,
    color: '#1a3048',
    opacity: 1,
    presetId: 'none'
  }
}

/** 工作区缺省天花：默认隐藏 */
export function createDefaultCeiling(_kind: DocumentKind = 'scene'): EnvironmentCeilingJSON {
  return {
    visible: false,
    color: '#2a3544',
    opacity: 1,
    presetId: 'none'
  }
}

/** 缺省墙体外观（不透明，避免半透明墙角 z-fight） */
export function createDefaultWall(): EnvironmentWallJSON {
  return {
    color: '#233242',
    opacity: 1,
    presetId: 'none',
    cornerOverlap: false,
    defaultHeight: 2,
    defaultThickness: 0.2
  }
}

export function cloneEnvironment(env: EnvironmentJSON): EnvironmentJSON {
  return JSON.parse(JSON.stringify(env)) as EnvironmentJSON
}

export function cloneWorkspace(ws: WorkspaceJSON): WorkspaceJSON {
  return JSON.parse(JSON.stringify(ws)) as WorkspaceJSON
}

/** 新建工作区草稿（outline ≥3） */
export function createDefaultWorkspace(
  outline: [number, number][],
  options?: { name?: string; height?: number; id?: string }
): WorkspaceJSON {
  return {
    id: options?.id ?? createId('ws'),
    name: options?.name,
    outline: outline.map(p => [...p] as [number, number]),
    height: options?.height,
    floor: createDefaultFloor('scene'),
    ceiling: createDefaultCeiling('scene')
  }
}
