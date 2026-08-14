import type * as ThreeNS from 'three'
import { MH_ASSET_HANDLE_KEY } from '@mh/3d-editor'
import { createDefaultContent, isContent } from './content'
import type { AlertBoxContentJSON, AlertBoxHandle } from './types'

const USERDATA_KEY = 'mhAlertBox'
const WALL_THICKNESS = 0.06
/** 抬离地板，减轻与地面共面的深度精度问题（site y=0 / room y=0.01） */
const FLOOR_LIFT = 0.05

/**
 * EasyV 风格电子围栏：立墙 + 下浓上淡 + 扫描条/网格流光。
 * 动效仅靠 material.uniforms.uTime，在 onBeforeRender 里推进，不依赖 editor 内核。
 */
const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying float vLocalY;
varying vec2 vWallUv;
uniform float uHeight;
void main() {
  vLocalY = clamp(position.y / max(uHeight, 0.001) + 0.5, 0.0, 1.0);
  // 墙面近似 UV：水平用 xz 周长感，垂直用高度
  vWallUv = vec2(position.x + position.z, vLocalY);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // editor 开了 logarithmicDepthBuffer：必须与内置材质同一套 log 深度，
  // 否则与墙/地深度不可比——侧视时「凡与墙平行的立面」都会像被墙整面挡住。
  #include <logdepthbuf_vertex>
}
`

const FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
uniform float intensity;
uniform float fadePower;
uniform float uTime;
varying float vLocalY;
varying vec2 vWallUv;

void main() {
  #include <logdepthbuf_fragment>
  // 主体：下浓上淡
  float fade = pow(clamp(1.0 - vLocalY, 0.0, 1.0), max(fadePower, 0.2));

  // 底边亮带（电子围栏常见「接地光」）
  float bottomRim = smoothstep(0.18, 0.0, vLocalY);

  // 水平细网格（静态）
  float gridV = abs(fract(vLocalY * 14.0) - 0.5);
  float gridH = abs(fract(vWallUv.x * 2.2) - 0.5);
  float grid = (1.0 - smoothstep(0.0, 0.04, gridV)) * 0.35
    + (1.0 - smoothstep(0.0, 0.03, gridH)) * 0.2;

  // 向上扫描光带（UV/高度滚动）
  float scan = fract(vLocalY * 1.2 - uTime * 0.45);
  float scanBand = smoothstep(0.0, 0.12, scan) * smoothstep(0.35, 0.12, scan);

  // 轻微脉冲
  float pulse = 0.85 + 0.15 * sin(uTime * 2.2);

  float glow = fade * 0.75 + bottomRim * 0.9 + scanBand * 0.85 + grid * fade;
  float alpha = clamp(glow * intensity * 0.55 * pulse, 0.0, 1.0);
  if (alpha < 0.02) discard;

  vec3 col = color * (0.45 + glow * 0.9) * intensity * pulse;
  gl_FragColor = vec4(col, alpha);
}
`

function createMaterial(
  THREE: typeof ThreeNS,
  content: AlertBoxContentJSON
): ThreeNS.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(content.color) },
      intensity: { value: content.intensity },
      fadePower: { value: content.fadePower },
      uHeight: { value: Math.max(content.height, 0.1) },
      uTime: { value: 0 }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })
}

function applyUniforms(
  material: ThreeNS.ShaderMaterial,
  content: AlertBoxContentJSON
): void {
  material.uniforms.color.value.set(content.color)
  material.uniforms.intensity.value = content.intensity
  material.uniforms.fadePower.value = content.fadePower
  material.uniforms.uHeight.value = Math.max(content.height, 0.1)
}

/** 四面有厚度墙体，围成空心方框 */
function rebuildWalls(
  THREE: typeof ThreeNS,
  meshes: ThreeNS.Mesh[],
  material: ThreeNS.ShaderMaterial,
  content: AlertBoxContentJSON
): void {
  const w = Math.max(content.width, 0.1)
  const d = Math.max(content.depth, 0.1)
  const h = Math.max(content.height, 0.1)
  const t = WALL_THICKNESS
  const y = h / 2 + FLOOR_LIFT

  const configs: Array<{
    pos: [number, number, number]
    size: [number, number, number]
  }> = [
    { pos: [0, y, d / 2], size: [w, h, t] },
    { pos: [0, y, -d / 2], size: [w, h, t] },
    { pos: [w / 2, y, 0], size: [t, h, d] },
    { pos: [-w / 2, y, 0], size: [t, h, d] }
  ]

  meshes.forEach((mesh, i) => {
    const cfg = configs[i]!
    mesh.geometry.dispose()
    mesh.geometry = new THREE.BoxGeometry(...cfg.size)
    mesh.position.set(...cfg.pos)
    mesh.rotation.set(0, 0, 0)
    mesh.material = material
  })
}

/** 创建电子围栏（四面墙 + 扫描流光动效） */
export function createModel(
  THREE: typeof ThreeNS,
  content?: AlertBoxContentJSON
): AlertBoxHandle {
  const cfg = isContent(content) ? content : createDefaultContent()
  const material = createMaterial(THREE, cfg)

  const root = new THREE.Group()
  root.name = 'alert-box'

  const meshes: ThreeNS.Mesh[] = []
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.name = `alert-box-wall-${i}`
    // 仅一面推进时间即可（共享 material）
    if (i === 0) {
      mesh.onBeforeRender = () => {
        material.uniforms.uTime.value = performance.now() * 0.001
      }
    }
    root.add(mesh)
    meshes.push(mesh)
  }
  rebuildWalls(THREE, meshes, material, cfg)

  const handle: AlertBoxHandle = {
    root,
    apply: next => {
      const c = isContent(next) ? next : createDefaultContent()
      applyUniforms(material, c)
      rebuildWalls(THREE, meshes, material, c)
    },
    dispose: () => {
      meshes.forEach(m => {
        m.onBeforeRender = () => {}
        m.geometry.dispose()
      })
      material.dispose()
    }
  }

  root.userData[USERDATA_KEY] = handle
  meshes.forEach(m => {
    m.userData[USERDATA_KEY] = handle
  })
  root.userData[MH_ASSET_HANDLE_KEY] = {
    apply: (props: Record<string, unknown> | undefined) => {
      const raw = props?.alertBox
      const next = isContent(raw) ? raw : createDefaultContent()
      handle.apply(next)
    },
    dispose: () => handle.dispose()
  }
  return handle
}

/** 刷新已挂到节点上的围栏参数（调试路径；常规走 Viewport3D props 同步） */
export function applyToObject(
  root: ThreeNS.Object3D | undefined,
  content: AlertBoxContentJSON
): boolean {
  if (!root) return false
  const direct = root.userData[USERDATA_KEY] as AlertBoxHandle | undefined
  if (direct?.apply) {
    direct.apply(content)
    return true
  }
  let found = false
  root.traverse(obj => {
    const h = obj.userData[USERDATA_KEY] as AlertBoxHandle | undefined
    if (h?.apply) {
      h.apply(content)
      found = true
    }
  })
  return found
}
