import type { DataSource, DataSourceNeed, PointSample } from '../types'
import { createDataSource } from './create'
import type { DataSourceConfig } from './types'

class EmptyDataSource implements DataSource {
  start(_need: DataSourceNeed[]): void {
    /* no-op */
  }
  stop(): void {
    /* no-op */
  }
  subscribe(_onBatch: (samples: PointSample[]) => void): () => void {
    return () => undefined
  }
}

class CompositeDataSource implements DataSource {
  private readonly sources: DataSource[]
  private unsubs: Array<() => void> = []

  constructor(sources: DataSource[]) {
    this.sources = sources
  }

  start(need: DataSourceNeed[]): void {
    for (const s of this.sources) s.start(need)
  }

  stop(): void {
    for (const s of this.sources) s.stop()
  }

  subscribe(onBatch: (samples: PointSample[]) => void): () => void {
    this.detach()
    this.unsubs = this.sources.map(s => s.subscribe(onBatch))
    return () => this.detach()
  }

  private detach(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
  }
}

/** 聚合多个 DataSource：start/stop/subscribe 扇出，样本合并推送 */
export function createCompositeDataSource(sources: DataSource[]): DataSource {
  if (sources.length === 0) return new EmptyDataSource()
  if (sources.length === 1) return sources[0]
  return new CompositeDataSource(sources)
}

/** 由配置列表创建并聚合 */
export function createCompositeDataSourceFromConfigs(configs: DataSourceConfig[]): DataSource {
  return createCompositeDataSource(configs.map(createDataSource))
}
