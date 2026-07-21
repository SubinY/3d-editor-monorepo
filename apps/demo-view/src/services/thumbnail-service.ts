import * as THREE from 'three'

export async function generateThumbnail(
  root: THREE.Object3D,
  options?: { width?: number; height?: number; format?: 'image/png' | 'image/webp' }
): Promise<Blob> {
  const width = options?.width ?? 320
  const height = options?.height ?? 200
  const format = options?.format ?? 'image/webp'

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 5000)

  const ambient = new THREE.AmbientLight(0xffffff, 0.85)
  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(2, 3, 4)
  scene.add(ambient, dir)

  const clone = root.clone(true)
  scene.add(clone)

  const box = new THREE.Box3().setFromObject(clone)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.7
  const dirVec = new THREE.Vector3(1, 0.9, 1.2).normalize()

  camera.position.copy(center.clone().addScaledVector(dirVec, distance))
  camera.lookAt(center)

  renderer.render(scene, camera)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (!result) reject(new Error('缩略图生成失败'))
      else resolve(result)
    }, format)
  })

  renderer.dispose()
  return blob
}
