# 地板纹理

仅保留运行时需要的 **diffuse / albedo**（`*_diff_1k.jpg`），来源 [Poly Haven](https://polyhaven.com/)：

| 文件 | 预设 |
|------|------|
| `laminate_floor_02_diff_1k.jpg` | 复合木地板 |
| `granite_tile_diff_1k.jpg` | 花岗岩 |
| `square_floor_diff_1k.jpg` | 方砖 |

Document 存相对路径如 `/textures/floor/laminate_floor_02_diff_1k.jpg`。

不要放入 `.blend` / `.zip` / normal / roughness / displacement——当前内核只加载颜色贴图。
