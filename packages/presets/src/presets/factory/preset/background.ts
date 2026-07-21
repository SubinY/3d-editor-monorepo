import type { FactoryPresetOptions } from './types'

let noiseTextureCache: string | null = null

function getNoiseTexture(): string {
  if (noiseTextureCache) return noiseTextureCache
  
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return ''
  
  const data = context.createImageData(size, size)
  for (let i = 0; i < data.data.length; i += 4) {
    const shade = 235 + Math.random() * 20
    data.data[i] = shade
    data.data[i + 1] = shade - 8
    data.data[i + 2] = shade
    data.data[i + 3] = 20
  }
  context.putImageData(data, 0, 0)
  noiseTextureCache = canvas.toDataURL('image/png')
  return noiseTextureCache
}

export function applyGradientBackground(
  container: HTMLElement,
  options?: FactoryPresetOptions['background']
) {
  const defaultGradient = ['160deg', '#1a0a2e 0%', '#16213e 40%', '#0f3460 100%']
  const gradientColors = options?.gradient ?? defaultGradient
  const gradientCss = `linear-gradient(${gradientColors.join(', ')})`
  
  const noise = options?.enableNoise !== false ? getNoiseTexture() : null
  container.style.backgroundImage = noise
    ? `${gradientCss}, url(${noise})`
    : gradientCss
  container.style.backgroundSize = '100% 100%, 256px 256px'
  container.style.backgroundRepeat = 'no-repeat, repeat'
  container.style.backgroundBlendMode = 'normal, overlay'
}

