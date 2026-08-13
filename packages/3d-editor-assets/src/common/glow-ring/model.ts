import type * as ThreeNS from 'three'
import { createDefaultContent, isContent } from './content'
import type { GlowRingContentJSON, GlowRingHandle } from './types'

const USERDATA_KEY = 'mhGlowRing'

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`

const FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 colorA;
uniform vec3 colorB;
uniform float highlightSpan;
uniform float highlightAngle;
uniform float intensity;
varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>
  // RingGeometry：u 沿圆周，v 沿径向
  float a = fract(vUv.x - highlightAngle / (2.0 * 3.14159265));
  float dist = min(a, 1.0 - a);
  float hi = 1.0 - smoothstep(0.0, max(highlightSpan, 0.02), dist);
  vec3 col = mix(colorB, colorA, hi);

  float edge = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
  float alpha = edge * (0.4 + 0.6 * hi) * intensity;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col * intensity, alpha);
}
`

function buildGeometry(
  THREE: typeof ThreeNS,
  content: GlowRingContentJSON
): ThreeNS.RingGeometry {
  const outer = Math.max(content.radius, 0.05)
  const band = Math.max(content.bandWidth, 0.01)
  const inner = Math.max(outer - band, 0.01)
  return new THREE.RingGeometry(inner, outer, 128, 1)
}

function applyUniforms(
  material: ThreeNS.ShaderMaterial,
  content: GlowRingContentJSON
): void {
  material.uniforms.colorA.value.set(content.colorA)
  material.uniforms.colorB.value.set(content.colorB)
  material.uniforms.highlightSpan.value = content.highlightSpan
  material.uniforms.highlightAngle.value = content.highlightAngle
  material.uniforms.intensity.value = content.intensity
}

/** 创建贴地 XZ 光圈（无立面高度） */
export function createModel(
  THREE: typeof ThreeNS,
  content?: GlowRingContentJSON
): GlowRingHandle {
  const cfg = isContent(content) ? content : createDefaultContent()

  const geometry = buildGeometry(THREE, cfg)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colorA: { value: new THREE.Color(cfg.colorA) },
      colorB: { value: new THREE.Color(cfg.colorB) },
      highlightSpan: { value: cfg.highlightSpan },
      highlightAngle: { value: cfg.highlightAngle },
      intensity: { value: cfg.intensity }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)
  // RingGeometry 默认在 XY，翻到 XZ 贴地
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = cfg.lift
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.name = 'glow-ring-mesh'

  const root = new THREE.Group()
  root.name = 'glow-ring'
  root.add(mesh)

  const handle: GlowRingHandle = {
    root,
    mesh,
    apply: next => {
      const c = isContent(next) ? next : createDefaultContent()
      mesh.geometry.dispose()
      mesh.geometry = buildGeometry(THREE, c)
      applyUniforms(material, c)
      mesh.position.y = c.lift
    },
    dispose: () => {
      mesh.geometry.dispose()
      material.dispose()
    }
  }

  root.userData[USERDATA_KEY] = handle
  mesh.userData[USERDATA_KEY] = handle
  return handle
}

/** 刷新已挂到节点上的光圈参数 */
export function applyToObject(
  root: ThreeNS.Object3D | undefined,
  content: GlowRingContentJSON
): boolean {
  if (!root) return false
  const direct = root.userData[USERDATA_KEY] as GlowRingHandle | undefined
  if (direct?.apply) {
    direct.apply(content)
    return true
  }
  let found = false
  root.traverse(obj => {
    const h = obj.userData[USERDATA_KEY] as GlowRingHandle | undefined
    if (h?.apply) {
      h.apply(content)
      found = true
    }
  })
  return found
}
