# @mh/3d-editor-twin

可选孪生绑定层：`props.twin` 读写、DataSource、规则求值、`TwinPlayer` 刷视口。

- **不是** `@mh/3d-editor` 内核，也不是只读播放器包
- 零 `three`；内置 `createDataSource({ type: 'http' | 'ws' | 'mqtt', ... })`
- 异形报文由 Host 注入可选 `mapResponse(raw, { need })`（http / ws / mqtt 均支持）
- MQTT 为客户端，需外部 broker；本地演示用 HTTP/WS 即可
- 编辑态只用 `readTwin` / `writeTwin`；预览/监控态再挂 `TwinPlayer`
- `TwinPlayer` / `collectTwinTargets` 可选 `resolveNested(node)`：扫一层嵌套 nodes，path 为 `parentId/childId`
- `collectUsedSourceIds(doc, resolveNested?)`：从可播目标收集 `points[].source` 去重，供 Host 按需建连

见 monorepo `docs/architecture.md`。
