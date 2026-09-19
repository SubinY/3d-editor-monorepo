import type { BoundsJSON, CameraViewType, DefaultViewJSON } from '../../../document/types'
import { cameraPoseAlongAxis } from '../helpers/world-view-gizmo'
import type { CameraLookOptions, CameraLookTarget } from '../types'
import { createIndoorDefaultView } from './indoor-view'

export interface LookContext {
  defaultView: DefaultViewJSON
  bounds: BoundsJSON
  currentTarget: [number, number, number]
  currentRadius: number
  currentProjection: CameraViewType
  selectedId?: string
  /** front 正交视窗宽高比；省略则 1 */
  aspect?: number
}

export type LookIntent =
  | {
      action: 'apply'
      view: DefaultViewJSON
      applyPose: boolean
      up?: [number, number, number]
      persist?: boolean
    }
  | {
      action: 'focus'
      path: string
      padding: number
      projection?: CameraViewType
    }
  | { action: 'noop' }

function withProjection(view: DefaultViewJSON, projection?: CameraViewType): DefaultViewJSON {
  if (!projection) return view
  return { ...view, type: projection }
}

export function createTopDefaultView(ctx: {
  bounds: BoundsJSON
  fit: 'scene' | 'keep'
  currentTarget: [number, number, number]
  currentRadius: number
  projection: CameraViewType
}): { view: DefaultViewJSON; up: [number, number, number] } {
  const width = Math.max(ctx.bounds.width, 0.5)
  const depth = Math.max(ctx.bounds.depth, 0.5)
  const height = Math.max(ctx.bounds.height ?? 2.5, 1)
  const span = Math.max(width, depth)
  const target: [number, number, number] =
    ctx.fit === 'keep' ? ctx.currentTarget : [0, 0, 0]
  const radius =
    ctx.fit === 'scene'
      ? Math.max(span * 1.4, height + span * 0.5, 2)
      : Math.max(ctx.currentRadius, span * 0.5, 1)
  const pose = cameraPoseAlongAxis(target, radius, 'y', 1)
  const diagonal = Math.hypot(width, depth, height)
  return {
    view: {
      type: ctx.projection,
      position: pose.position,
      target,
      fov: ctx.projection === 'orthographic' ? Math.max(span * 1.4, 1) : 50,
      minDistance: 0.3,
      maxDistance: Math.max(diagonal * 1.2, radius * 2, 8)
    },
    up: pose.up
  }
}

const FRONT_DEFAULT_PADDING = 1.15
const FRONT_PERSPECTIVE_FOV = 50

/** 正面（+Z）：柜体中心，正交默认；fov 为垂直视窗高度（米） */
export function createFrontDefaultView(ctx: {
  bounds: BoundsJSON
  aspect: number
  padding?: number
  projection?: CameraViewType
}): { view: DefaultViewJSON; up: [number, number, number] } {
  const width = Math.max(ctx.bounds.width, 0.1)
  const depth = Math.max(ctx.bounds.depth, 0.1)
  const height = Math.max(ctx.bounds.height ?? 2, 0.1)
  const aspect = Math.max(ctx.aspect, 0.2)
  const padding = ctx.padding ?? FRONT_DEFAULT_PADDING
  const projection = ctx.projection ?? 'orthographic'
  const target: [number, number, number] = [0, height * 0.5, 0]
  const orthoSize = Math.max(height, width / aspect) * padding
  const radius =
    projection === 'orthographic'
      ? Math.max(depth * 0.5 + orthoSize * 0.5, depth + 0.4, 1)
      : (() => {
          const halfFov = Math.tan((FRONT_PERSPECTIVE_FOV * Math.PI) / 180 / 2)
          const distH = (height * 0.5 * padding) / halfFov
          const distW = (width * 0.5 * padding) / (halfFov * aspect)
          return Math.max(distH, distW, depth * 0.5 + 0.4)
        })()
  const pose = cameraPoseAlongAxis(target, radius, 'z', 1)
  const diagonal = Math.hypot(width, depth, height)
  return {
    view: {
      type: projection,
      position: pose.position,
      target,
      fov: projection === 'orthographic' ? Math.max(orthoSize, 0.2) : FRONT_PERSPECTIVE_FOV,
      minDistance: 0.2,
      maxDistance: Math.max(diagonal * 1.2, radius * 2, 8)
    },
    up: pose.up
  }
}

export function resolveLookIntent(
  target: CameraLookTarget,
  ctx: LookContext,
  options?: CameraLookOptions
): LookIntent {
  const padding = options?.padding ?? 1.4

  if (target.at === 'home') {
    return {
      action: 'apply',
      view: withProjection(ctx.defaultView, options?.projection),
      applyPose: options?.applyPose ?? true
    }
  }

  if (target.at === 'pose') {
    return {
      action: 'apply',
      view: withProjection(target.view, options?.projection),
      applyPose: options?.applyPose ?? true
    }
  }

  if (target.at === 'indoor') {
    const view = createIndoorDefaultView(ctx.bounds, {
      type: options?.projection ?? 'orbit',
      fov: ctx.defaultView.fov ?? 60
    })
    return {
      action: 'apply',
      view,
      applyPose: true,
      persist: target.persist === true
    }
  }

  if (target.at === 'top') {
    const { view, up } = createTopDefaultView({
      bounds: ctx.bounds,
      fit: target.fit ?? 'scene',
      currentTarget: ctx.currentTarget,
      currentRadius: ctx.currentRadius,
      projection: options?.projection ?? 'orthographic'
    })
    return { action: 'apply', view, applyPose: true, up }
  }

  if (target.at === 'front') {
    const { view, up } = createFrontDefaultView({
      bounds: ctx.bounds,
      aspect: ctx.aspect ?? 1,
      padding: options?.padding ?? FRONT_DEFAULT_PADDING,
      projection: options?.projection ?? 'orthographic'
    })
    return { action: 'apply', view, applyPose: true, up }
  }

  if (target.at === 'node') {
    return {
      action: 'focus',
      path: target.path,
      padding,
      projection: options?.projection
    }
  }

  const path = ctx.selectedId
  if (!path) return { action: 'noop' }
  return {
    action: 'focus',
    path,
    padding,
    projection: options?.projection
  }
}
