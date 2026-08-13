const cache = new Map<string, HTMLImageElement | null>()

/** 带缓存的图片加载；失败返回 null */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  const cached = cache.get(url)
  if (cached !== undefined) return Promise.resolve(cached)
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cache.set(url, img)
      resolve(img)
    }
    img.onerror = () => {
      cache.set(url, null)
      resolve(null)
    }
    img.src = url
  })
}
