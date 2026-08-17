import type { DataSource } from '../types'
import { HttpDataSource } from './http'
import { MqttDataSource } from './mqtt'
import type { DataSourceConfig } from './types'
import { WsDataSource } from './ws'

/** 按外部配置创建内置 DataSource */
export function createDataSource(config: DataSourceConfig): DataSource {
  switch (config.type) {
    case 'http': {
      const { type: _t, ...rest } = config
      return new HttpDataSource(rest)
    }
    case 'ws': {
      const { type: _t, ...rest } = config
      return new WsDataSource(rest)
    }
    case 'mqtt': {
      const { type: _t, ...rest } = config
      return new MqttDataSource(rest)
    }
    default: {
      const _exhaustive: never = config
      throw new Error(`Unknown DataSource type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
