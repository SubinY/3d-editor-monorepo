import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { instantiateProceduralModule } from '@mh/3d-editor'

/** 独立小预览：加载 /models/...mjs 并挂到 canvas */
export class ModelPreviewViewport {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private root: THREE.Group | null = null
  private raf = 0
  private disposed = false
  private pmrem: THREE.PMREMGenerator

  constructor(private container: HTMLElement) {
    const w = container.clientWidth || 480
    const h = container.clientHeight || 360
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50)
    this.camera.position.set(0.35, 0.28, 0.45)

    this.scene.background = new THREE.Color('#0b1220')
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const hemi = new THREE.HemisphereLight(0xddeeff, 0x223344, 0.55)
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(2, 4, 3)
    key.castShadow = true
    this.scene.add(hemi, key)

    const grid = new THREE.GridHelper(1.2, 12, 0x334455, 0x1a2433)
    this.scene.add(grid)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.08, 0)
    this.controls.update()

    const loop = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  async loadModule(
    url: string,
    footprint: { width: number; depth: number; height: number }
  ): Promise<void> {
    if (this.root) {
      this.scene.remove(this.root)
      this.root.traverse(obj => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(m => m?.dispose?.())
        }
      })
      this.root = null
    }
    const object = await instantiateProceduralModule(url, THREE, { footprint })
    const group = object as THREE.Group
    this.root = group
    this.scene.add(group)
    const midY = footprint.height * 0.5
    this.controls.target.set(0, midY, 0)
    this.camera.position.set(
      Math.max(0.28, footprint.width * 2.2),
      midY + footprint.height * 0.35,
      Math.max(0.35, footprint.depth * 2.8 + footprint.height * 0.6)
    )
    this.controls.update()
  }

  resize(): void {
    const w = this.container.clientWidth || 480
    const h = this.container.clientHeight || 360
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
