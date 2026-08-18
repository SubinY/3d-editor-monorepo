import * as THREE from 'three'

/**
 * 无限网格：单 quad + shader 画线，顶点跟相机 XZ 平移，远处按距离淡出。
 * 几何恒为 4 顶点，不随格子密度增长。
 */
export function createInfiniteGrid(options?: {
  /** 细格间距（米） */
  size1?: number
  /** 粗格间距（米） */
  size2?: number
  color?: THREE.ColorRepresentation
  /** 平面半径兼淡出距离 */
  distance?: number
}): THREE.Mesh {
  const size1 = options?.size1 ?? 1
  const size2 = options?.size2 ?? 10
  const distance = options?.distance ?? 400
  const color = new THREE.Color(options?.color ?? 0x4a7ea8)

  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize1: { value: size1 },
      uSize2: { value: size2 },
      uColor: { value: color },
      uDistance: { value: distance },
    },
    vertexShader: `
      varying vec3 worldPosition;
      uniform float uDistance;

      void main() {
        vec3 pos = position.xzy * uDistance;
        pos.xz += cameraPosition.xz;
        worldPosition = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 worldPosition;
      uniform float uSize1;
      uniform float uSize2;
      uniform vec3 uColor;
      uniform float uDistance;

      float getGrid(float size) {
        vec2 r = worldPosition.xz / size;
        vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
      }

      void main() {
        float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0);
        float g1 = getGrid(uSize1);
        float g2 = getGrid(uSize2);
        gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0));
        gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2);
        if (gl_FragColor.a <= 0.0) discard;
      }
    `,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  // 略高于 y=0 地板，减轻共面闪烁
  mesh.position.y = 0.02
  mesh.name = 'infinite-grid'
  mesh.userData.nonSelectable = true
  mesh.raycast = () => {}
  return mesh
}
