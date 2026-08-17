# @mh/3d-editor-twin

可选孪生绑定层：`props.twin` 读写、DataSource、规则求值、`TwinPlayer` 刷视口。

- **不是** `@mh/3d-editor` 内核，也不是只读播放器包
- 零 `three`；内置 `createDataSource({ type: 'http' | 'ws' | 'mqtt', ... })`
- MQTT 为客户端，需外部 broker；本地演示用 HTTP/WS 即可
- 编辑态只用 `readTwin` / `writeTwin`；预览/监控态再挂 `TwinPlayer`

见 monorepo `docs/architecture.md`。
