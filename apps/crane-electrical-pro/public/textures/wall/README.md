# 墙体纹理

仅保留运行时需要的 **diffuse / albedo**（`*_diff_1k.jpg`），来源 [Poly Haven](https://polyhaven.com/)：

| 文件 | 预设 |
|------|------|
| `corrugated_iron_02_diff_1k.jpg` | 波纹铁皮 |
| `rusty_metal_04_diff_1k.jpg` | 锈蚀金属 |

Document 存相对路径如 `/textures/wall/corrugated_iron_02_diff_1k.jpg`。

不要放入 `.blend` / `.zip` / normal / roughness / displacement——当前内核只加载颜色贴图。
