# 架构评审报告：3d-editor monorepo

评审时间：2026-08 · 评审对象：master 分支 · 方法：四路独立审计（核心包分层 / Three.js 渲染层 / 宿主接入面 / \_dev 对比与市场对标）后交叉验证

---

## 0. 总论：两头失败的内核

四份独立报告合起来指向同一个结构性判断——**内核在"太具体"和"太抽象"两头同时失败了**。

- **Schema 层过度具体**：`document/types.ts:81-87` 的 `enclosure` 枚举里写着 `openBoxDoor` / `outdoorCabinet`，`viewport/three/helpers/enclosure.ts:191-362` 有 300 多行户外电柜几何。这些行业词汇进了**存盘契约**，意味着换个行业既改不动也删不掉。
- **能力层过度稀薄**：对外只有 9 条命令（placeItem / transformNode / removeNode / updateNode / addWall / removeWall / moveWalls / setBounds / setEnvironment）和 4 个扩展缝（catalog / procedural.resolve / onInteraction / onDenied）。没有编组、批量、复制、reparent，没有生命周期钩子。

夹在中间那层"编辑器产品能力"——属性面板、大纲树、资源面板、环境面板、快捷键、撤销 UI、相机操作、数据绑定——**完全空缺**。后果可量化：`crane-electrical-pro` 用约 4,100 行代码重新造了一遍 `electrical-room` 已有的能力，其中真正与"起重机行业"相关的不足 400 行，**87% 是被内核缺失逼出来的重复劳动**。

所以现在这套东西**可复用的是渲染内核，不是编辑器**。每接一个行业，团队要重付一次编辑器 UI 的钱。

---

## 1. 交叉验证：被多路独立确认的事实

以下结论由两路以上互不通气的审计各自得出，可信度最高。

### 1.1 能力天花板 300–500 节点（架构 + 渲染）

两条完全不同的推理路径落到同一量级：

- 架构侧依据：GLTF 无缓存 + `buildAllNodes` 串行 await（`Viewport3D.ts:468-472`）+ 碰撞 O(n) 线性扫（`collision.ts:82`）+ 三份互不同步的 itemCache
- 渲染侧依据：drawcall 预算。无 instancing / merge / LOD，`shadowMap.autoUpdate` 未关导致每帧 drawcall 翻倍

细分数字更值得警惕：`outdoorCabinet` 单个柜体 41 个 mesh（含 12 个球体铆钉），含阴影 82 drawcall，**摆 12 个柜子就到 60fps 上限**。

但**真正的第一道墙不是渲染，是拾取**。hover 完全无节流，每次 mousemove 都 `Array.from(nodeRoots)` 后递归 raycast 整棵子树（`services/selection.ts:82-109`、`ThreeRuntime.ts:351-364`）。120Hz 鼠标 + 2000 节点 × 40 mesh 的组合下单次 raycast 估算 130ms——渲染还能跑的时候，交互已经先卡死。

### 1.2 `props` 变更不驱动重建，撤销已经在失真（架构 + 渲染 + 宿主，三路确认）

`syncNodeObject`（`Viewport3D.ts:717-728`）只同步 transform 和 visible。而 procedural 资产的内容全部从 `node.props` 读。于是两个宿主写出了一模一样的绕过代码：

- `apps/electrical-room/src/components/Workbench.vue:599-607`
- `apps/crane-electrical-pro/src/views/EditorView.vue:403-411`

都是 `updateNode(props)` 之后拿 `viewport3d.getNodeObject()` 手工 patch。**后果**：Ctrl+Z 回退了 Document 里的 `props.panel`，画面停在新贴图上，文档与画面永久不一致。这不是架构瑕疵，是功能性 bug。而且每接一个 props 驱动的资产（glowRing、alertBox 已在 catalog 里）就要再抄一遍。

### 1.3 无 schema 迁移能力（架构 + 宿主 + 市场，三路确认）

`document/types.ts:174` 的注释是自认的：「开发期字段戳；不做按版本分支或迁移」。`fromJSON`（`EditorDocument.ts:620-636`）不看版本、不校验、不补字段。后端 `store.ts:122-145` 把 document 当不透明 blob 存盘。

`apps/electrical-room-api/data/documents/scenes/*.json` 已经是落盘的真实数据。**第一次破坏性 schema 变更即数据断代**，而数字孪生场景的生命周期按年算。这是三路一致认为 ROI 最高的补课项——参照 tldraw 的 `id + up/down + scope` 模型，200 行以内。

### 1.4 行业语义进了内核契约（架构 + 宿主）

除 1.1 提到的 `enclosure` 外还有：`DocumentKind = 'scene' | 'container'` 是闭合联合，且这个分支散落在至少 6 个文件；`structure.walls` 把"墙"提升为文档根实体；`CatalogItem.shell3d` 的注释写着"柜体外壳"。

反向的泄漏同样存在：`CatalogCategory`（`catalog/types.ts:57`）是封闭联合 `'wall' | 'fixture' | 'equipment' | 'component'`，而自家的 `@mh/3d-editor-assets` 已经违约写出了 `category: 'effect'`。之所以没编译报错，是因为**两个 app 都没有 typecheck 脚本**。

### 1.5 裁不出轻量运行时（架构 + 市场 + 宿主）

包只有一个 `.` 导出入口；`createEditor` 静态引入 2D+3D 两套视口；`ThreeRuntime` 顶层静态引入 TransformControls / GLTFLoader；`readonly: true` 依然构造完整 Document（history 栈、约束引擎、碰撞索引）。四个只读页面（Preview / DashboardHome / RuntimeView / UxDemo）现在都背着完整编辑器。

`readonly` 只是"不给 gizmo"，不是"不含编辑能力"——交付时无法向客户声明这是只读产物。

---

## 2. 单路发现但影响重大的问题

### 2.1 节点树是半成品（架构侧）

`EditorNodeJSON.children` 存在、索引会递归、`placeItem({ parentId })` 能调用，但 2D 和 3D 视口都只遍历顶层节点（`Viewport3D.ts:468-472`、`paint.ts:320`），父子变换不继承。`insertNodeInternal` 把节点 push 进父的 children 后 emit `node:added`，而 Viewport3D 的监听器丢弃了 payload 里的 parentId，直接把它当新的场景根对象加进 scene。

实际后果：父节点移动时子节点纹丝不动；父节点删除时 `removeNodeObject(parentId)` 只删父的 Object3D，**子的 Object3D 永久泄漏在场景里**。测试零覆盖。

这是最坏的一种半成品：API 存在、行为错误、没人知道它不能用。

### 2.2 `styleAsShell` 静默失效，且正好打在核心卖点上（渲染侧）

`Viewport3D.styleAsShell()`（`:609-621`）设了 `mat.opacity = 0.88` 但**没设 `mat.transparent = true`**，`MeshStandardMaterial` 会完全忽略 opacity。代码注释写的是"外壳半透明，保证柜内元件可见、可高亮"，实际渲染出来是完全不透明的柜子。

结合第 4 节的定位建议看，这条的严重性要上调一级——**柜内可视性是这个产品的差异化根基，而它一直是坏的**。

### 2.3 确定性显存泄漏（渲染侧）

`removeNodeObject`（`:696-715`）只做 `geometry.dispose()` 和 `material.dispose()`。**`Material.dispose()` 在 three 中不释放它引用的 texture**。面板默认 1024×512 带 mipmap 约 2.75MB/个，反复增删 50 次 = 137MB 不可回收。资产包里写好的三个 `Handle.dispose()` 从来没被 Viewport3D 调用过。

长时间运行的监控大屏必然 OOM。

### 2.4 视觉品质的根因是照明，不是模型（渲染侧）

全仓无 `PMREMGenerator`、无 `toneMapping`，`scene.environment` 从不赋值。后果：

- `outdoorMetalMaterial` 写了 `metalness: 0.65`，但金属的漫反射为 0、镜面反射无源可采，只能渲染成死黑。用户感知到的"塑料感"就是这么来的。
- 无 tone mapping 意味着 >1.0 亮度直接 clamp 成纯白，而告警特效用的是 AdditiveBlending，叠加后死白成一片。
- 灯光只有 ambient + directional 两型，背光面是纯粹的平色，体积感丧失。

好消息：`RoomEnvironment` + PMREM + ACES 三件套是纯代码改动，不需要任何美术资产，投入产出比全项目最高。

### 2.5 数据绑定被发明了两次且互不兼容（宿主侧）

这是数字孪生的核心能力，现在两套并存：

| | electrical-room | crane-electrical-pro |
|---|---|---|
| 方案 | **可配置**：10 个内置点位 key + `PointBinding` / `ConditionWhen` / `NodeEventRule` + 规则求值引擎 + 527 行绑定编辑 UI | **硬编码**：4 状态固定色板 + `/柜/.test(name)` 正则识别设备 + `if (i === 2) status = 'fault'` 造数据 |
| 落库 | 写进 `node.props.bindings/events`，随文档走 | 不落库 |
| 文件 | `business/node-bindings.ts`、`point-runtime.ts`、`DataPanel.vue` | `utils/visual-state-map.ts`、`stores/runtime.ts` |

ER 的方案明显更成熟，而且绑定数据落在 props 里随 document 走，**天然可跨宿主迁移——这是现有设计里最正确的一处**。crane 的存在恰好证明了它没被复用。

另外 crane 编辑态的 `applyProps` 会写 `props.status`，但编辑态画面完全不响应——这个字段在编辑器里是死的。

### 2.6 设计意图随归档一起被删了（\_dev 对比）

`git merge-base master _dev` = `030efaa`，**\_dev 的 HEAD 就是 master 的祖先**。而 \_dev 自己的 `docs/architecture.md` 里已写明 engine/extensions/presets 是 legacy、`packages/editor` 才是对外唯一必选包。

所以"精简"这个动作本身几乎无可指摘——架构决策是在 \_dev 内部就做完的，master 只是执行归档。但被一起删掉的还有 `architecture.md` 的 D1~D7 定稿决策、`sdk-guide.md`、`reading-guide.md`，以及 `SceneSchema` 里那些没实现但形状想清楚了的类型（postProcessing / animation / controls）。master 的 `AGENTS.md` 只剩 30 行。

**本次评审必须回 \_dev 分支挖，才能搞清楚 master 的设计意图。** 半年后没有人（包括作者）能说清为什么 `EnvironmentJSON` 只有两种光。

---

## 3. \_dev → master 的得失裁决

**立场：重构方向完全正确，删除动作 90% 正确，但存在一次真实的能力回退，且被"架构更干净"的叙事掩盖了。**

### 解决掉的真问题（都很关键）

| \_dev 的病 | master 的药 |
|---|---|
| 双真相源：engine 以 Object3D 为真相，editor 以 Document 为真相，两套 history 并存 | Document 唯一权威，单一历史栈，2D/3D 共栈 |
| 序列化 bake 几何：SceneSerializer 把 geometry/material/texture 内联进 JSON | `catalogRef: { id, version }` 引用式 + 发布时冻结静态快照 |
| 四包互相依赖 + 29MB 二进制入库 | 单包 + peer three，资产清理 |
| 行业语义泄漏进"平台包"（presets/factory） | 内核零行业语义（**但这条只做到一半，见 1.4**） |

### 丢了且没重建的

| 丢失项 | 是真损失吗 |
|---|---|
| 时间轴 / 关键帧动画（`TimelinePlayer` 4.4KB，四类轨道插值） | **是。** 巡检路径、AGV 轨迹、开关门、告警呼吸全部无处安放 |
| 编组 / 解组 / 对齐分布（`EditorActions` + `AlignmentTool`） | **是，纯净损失** |
| 插件生命周期（`EnginePlugin` + 6 个钩子） | **是，且没有任何替代形态** |
| Preset 场景装配 | 半损失。环境配置被 `EnvironmentJSON` 声明式接管了（是进步），但"带逻辑的装配"无处安放 |
| SceneSchema 的类型词汇表（postProcessing / physics / MaterialSchema） | 形式上是损失，实质不是——全是没实现的声明。但丢掉了"思考过的接口形状" |

判词：**不是把可扩展性精简掉了，是为了活下去先把它抵押了，现在到了该赎回的时候。** 赎回时不该照抄 `EnginePlugin`（它把整个 CoreContext 交出去，权限太大），应基于 Document 模型设计窄接口。

### 宿主接入模型：master 明显更健康

\_dev 的 Host 面对的是 Three.js 类型（`THREE.Vector3`、`Object3D`），意味着 Host 必须懂三维引擎；`useAssetEditor.ts` 1083 行、`SceneRightPanel.vue` 941 行的规模是内核抽象不足的信号；demo-view 还有 4 个 Pinia store 与 Object3D 树并行——这正是 D1 决策要禁的东西，说明这个坑是踩过了才写进定稿的。

唯一要给 \_dev 记一功的：demo-view 有 `model-import-service` / `thumbnail-service` / `seed-resource-service` 这套**资产入库工作流**，master 一行都没有对应物。这个值得捡回来。

---

## 4. 市场定位：不要做全能产品

### 能力矩阵摘要

对标图扑 HT、ThingJS、EasyV、乐吾乐、Sovit3D，以及 Babylon Editor、PlayCanvas、Needle Engine：

**已达到甚至超过国产组态产品的**（4 项）：

- 文档契约与渲染解耦（`EditorDocumentJSON` 与 three 无关）
- 资产按 `(id, version)` 钉版
- 发布时冻结静态快照，监控端不回活库（`buildPublishBundle`）
- **柜内元件级寻址**：`setNodeVisualState('nodeId/childId')`。市场上"设备级"是主流，"元件级"是空白

另外 `model3d: { type: 'procedural', id, url? }` 这条可 JSON 序列化、远程动态 `import()` 的模型引用设计，在对比的所有产品里都算新颖（AI 生成的模型可打包成 `.mjs` 直接进资产库）。安全上是全权限执行，需记一笔。

**基本空白的**（4 项）：数据绑定与实时驱动、交互脚本与逻辑编排、渲染品质（无后处理/IBL/粒子）、协作。

### 定位建议：收缩到"能看到柜子里面的数字孪生"

**不要正面打图扑/EasyV 的园区级组态平台。** 他们在 2D 组态、数据源适配（含金仓达梦信创）、素材库上的存量追不上；追的过程中每项只能做到 60 分，而 60 分的全能产品在国内 To B 卖不掉。

建议收缩到**建筑内部到设备内部**这一段：电柜室 → 电柜 → 柜内元件；机房 → 机柜 → U 位设备。核心卖点是**别人下钻不到的那一层**。

这不是拍脑袋，代码里有三条硬证据说明产品直觉已经在往这个方向走，只是没有明说：

1. `kind: 'scene' | 'container'` 的二元设计——container 的 2D 是立面视图（`y = 物件底边离地高度`），这是柜内布局的专属交互，通用编辑器不会做
2. document 型 CatalogItem 的递归嵌套解析已跑通——一个电柜是一份可独立编辑、可版本化、可复用的文档。ThingJS/图扑的"下钻"是切场景，你的下钻是同一份文档树
3. 元件级寻址已实现

目标客户是电力/轨交/工业配电的**设备厂商和运维方**（有元件级运维诉求），不是要做园区大屏的甲方。

### 明确"永远不做"

多人实时协作、通用资产市场、物理引擎、GIS/城市级瓦片、VR/AR、自研渲染引擎、可视化蓝图编辑器。2D 组态若真要做，集成 MIT 的 meta2d.js，不要自研。

---

## 5. 执行清单

筛选标准：**垂直定位相关性 × 第一个客户会不会引爆**。

### Tier 0：立刻做（1–2 周，全部低风险）

| 项 | 解决 | 备注 |
|---|---|---|
| apps 加 `vue-tsc --noEmit` 进 CI，加一条消费 `dist` 的构建作业 | 1.4 | 会立刻暴露 `category: 'effect'` 等潜伏违约。目前宿主永远吃源码，从未验证过 dist 导出面是否够用 |
| `styleAsShell` 补 `transparent` + `depthWrite` + `renderOrder` | 2.2 | **核心卖点的可视性一直是坏的** |
| 贴图释放 + handle 生命周期收归 Viewport3D | 2.3 | 消除确定性显存泄漏 |
| hover raycast 用 rAF 节流 + 维护扁平 pickable 数组 | 1.1 | 当前最大的交互瓶颈 |
| `setPixelRatio(Math.min(dpr, 2))` | — | 高 DPI 设备帧率 +100%~300% |
| `renderer.info` 接入性能面板 | — | 现在统计的是 mesh 数不是 drawcall，`info.memory.textures` 还能直接观测泄漏 |
| `shadowMap.autoUpdate = false` | — | 静态场景 drawcall 直接减半 |
| `buildNode` 加 per-id token | 2.1 | 消除快速增删产生的幽灵对象 |
| 纹理预设上收 `@mh/3d-editor-assets`；`procedural.resolve` 改数组 | — | 两份预设文件近乎逐字节重复，是"该上收"的最无争议样本 |
| 把 \_dev 的 `architecture.md` D1~D7 捞回 master 并更新 | 2.6 | 成本几乎为零，价值极高 |

### Tier 1：定位攻坚（2–3 个月）

1. **schema 迁移管线**（`id + up/down + scope`）+ `fromJSON` 校验 + id 换 nanoid。**必须排在任何 schema 手术之前**，否则修行业耦合会把现有落盘数据全部报废。
2. **`props` 变更驱动重建**：`CatalogItem` 加 `update` 钩子或让 resolver 返回带 `update(node)` 的 handle，消灭两处手工 patch，修好撤销。
3. **数据绑定内核化**：以 electrical-room 的方案为蓝本抽 `@mh/3d-editor-runtime`（binding schema + 规则引擎 + 数据源适配接口），让 crane 的 RuntimeView 改吃它。**这是"数字孪生可复用"的验收点。**
4. **批量与层级命令**：`duplicateNode` / `groupNodes` / `reparentNode` / `alignNodes` / `transformNodes` + `history.transaction`。同时把 `children` 真正实现（递归 build、Object3D 父子挂载、世界/局部矩阵换算）——图层树现在只能看不能编。
5. **渲染三件套**：PMREM + `scene.environment`（`RoomEnvironment` 兜底）、ACES tone mapping、bloom/outline 后处理。纯代码改动，视觉水准会从"WebGL demo"跨到"可以给客户演示"。
6. **行业语义搬出内核**：`enclosure` 降为 `{ pluginId, params }`，柜体几何移入 `@mh/industry-electrical`；`CatalogCategory` 开放；`DocumentKind` 改为 `editPlane: 'xz' | 'xy'` 之类的能力描述。

### Tier 2：规模化与产品化（6–12 个月）

- 拆包：`kernel`（零 three 依赖，可 Node 跑）/ `runtime`（只读播放器）/ `view`（编辑交互）/ `editor`（门面）。先解掉三条循环边：3D 依赖 `canvas2d/utils/closed-loops`、`ThreeRuntime` 反向 import `core`、`core/types` 与 `Viewport3D` 的类型环。
- 轻量播放器 `@mh/3d-viewer` + iframe 嵌入协议（postMessage：高亮 / 切视角 / 点击回调）。
- gltf 缓存 + 引用计数 + `SkeletonUtils.clone`；Draco/KTX2/Meshopt；InstancedMesh；`three-mesh-bvh` 加速拾取；面板贴图按内容哈希共享。
- 时间轴与路径动画（复用 \_dev 的 `TimelinePlayer` 插值逻辑，但改为 Document 契约驱动）。
- 三个窄扩展点：`onDocumentChange(patch)` / `onBeforeFrame(dt, 受限ctx)` / `registerNodeRenderer(kind, factory)`。**不做沙箱和 UI 贡献点。**
- 资产入库工作流（捡回 \_dev 的 `model-import-service` / `thumbnail-service`）+ 配电行业窄素材包。
- three 升级到 r17x+（先改 `TransformControls.getHelper()`）；两个自定义 GLSL shader 趁现在只有 60 行改写为 TSL，为 WebGPU 留路。

---

## 6. 目标分层

```
┌─ 宿主 apps（每行业一个）目标 < 800 行 ────────────────────┐
│  路由 / 后端适配 / 品牌主题 / 行业特有页面                  │
├─ @mh/industry-electrical（行业中间层）600–1000 行 ────────┤
│  CatalogItem 目录 · 属性 schema · 状态枚举与色板            │
│  分组规则 · 柜体 enclosure 插件 · 场景模板 · 点位字典       │
├─ 通用能力层 ──────────────────────────────────────────────┤
│  @mh/3d-editor-vue      composables（会话/选中/大纲/历史）  │
│  @mh/3d-editor-ui       可换皮面板组件（schema 驱动）        │
│  @mh/3d-editor-runtime  绑定 schema + 规则引擎 + 数据源接口 │
│  @mh/3d-editor-assets   程序化资产 + 内容 schema + 预设数据 │
├─ @mh/3d-editor（内核，framework-agnostic，peer three）────┤
│  Document / commands / history / selection / camera        │
│  Catalog 契约 · Viewport2D · Viewport3D · 扩展缝           │
└────────────────────────────────────────────────────────────┘
依赖方向严格单向向下。内核不得 import 上面任何一层。
```

四个关注点的归属：

| 关注点 | 内核 | 通用层 | 行业层 | 宿主 |
|---|---|---|---|---|
| 属性面板 | `PropertySchema` 定义 + `updateNode` 唯一写入口 | `-ui` 渲染器 | 电气字段 schema | 主题 |
| 资产 | `Model3DSpec` + resolver 数组 + `update` 钩子 | `-assets` 通用几何与预设 | 断路器、柜体外壳 | 不写模型 |
| 运行时 | `VisualState` 应用 + 只读会话 + `onInteraction` | `-runtime` 规则引擎 | 状态枚举与色板 | 真实点位 API |
| 数据绑定 | `props.$bindings` 命名空间 + 随撤销走的写入命令 | `-runtime` 求值器；`-ui` 绑定编辑器 | 点位字典与中文标签 | 绑定 UI 摆放 |

**验收标准（可度量）**：第三个行业宿主自写代码 < 1,000 行，其中行业专属 > 70%。当前基线是 4,100 行 / 行业专属 10%。

---

## 7. 关于"资产代码化"的独立结论

用 TS 函数生成 three 对象树这套方案，评审结论不是好或坏，而是**有明确的适用边界**：

| 资产类型 | 方案 | 理由 |
|---|---|---|
| UI / 特效 / 数据可视化（面板、光圈、围栏、流光） | **保持代码化** | 本来就没有美术模型可言；参数化能力强；content JSON 就是完整定义，存盘/diff/后端下发天然可行；已支持远程 ESM 热更新 |
| 参数化建筑（墙、地面、天花） | **保持代码化** | 尺寸由 document 驱动，当前 `helpers/floor.ts` 的做法正确 |
| 设备本体、柜体、建筑构件 | **迁移到 glTF + KTX2 + Draco** | `enclosure.ts` 365 行描述一个柜子是反面案例：美术协作断裂、视觉上限锁死在参数化基本体拼接、只能堆几何硬凑细节（12 个球体铆钉 = 24 drawcall，同样效果用一张法线贴图是零额外开销） |

`Model3DSpec` 已经把 gltf / primitive / procedural 三种并列，架构上这条路是通的，迁移不需要改内核，只需要美术产出 + catalog 数据切换。

需补一项：程序化资产应按 content 哈希做实例缓存，现在每个节点独立 `createModel`，同内容面板不共享贴图。

---

## 附：评审覆盖范围

| 审计线 | 覆盖 | 产出 |
|---|---|---|
| 核心包分层 | `packages/3d-editor` 56 文件约 6.2k 行、`3d-editor-assets` 21 文件约 0.9k 行 | 17 条缺陷 + 目标接口草案 |
| Three.js 渲染层 | `viewport/`、`helpers/`、`services/`、assets 的 model/bake | 20 条缺陷 + 性能量化估算 |
| 宿主接入面 | 两个 host 全量 + api 后端 | 17 条缺陷 + 15 项重复清单（带行数） |
| \_dev 对比与市场对标 | `git show` 只读读取 \_dev；8 个商业/开源产品 | 得失清单 + 能力矩阵 + 定位建议 |
