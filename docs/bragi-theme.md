# Bragi 颜色体系

Bragi UI 使用独立的 `--bragi-*` CSS 变量（见 `src/styles.css` 顶部），**不跟随 Obsidian accent**，也**不直接依赖 Tailwind CSS**。

灰阶参考 [Tailwind CSS neutral 色板](https://tailwindcss.com/docs/customizing-colors)：同一套层级关系，部分 hex 与 Tailwind 完全一致，部分是邻近的自定义值（例如 toolbar 用纯白而非 neutral-50）。

## 原则

| 场景 | 用什么 |
|------|--------|
| 画布、节点、toolbar、面板 | `--bragi-*` |
| 连线 hover / 选中 | Obsidian `--color-accent` |
| 连线默认色 | `--bragi-edge-default` |

## Light 模式 · 对照 Tailwind neutral

| Bragi token | 值 | Tailwind 参考 |
|-------------|-----|---------------|
| `--bragi-canvas-bg` | `#f5f5f5` | neutral-100 |
| `--bragi-surface` | `#ffffff` | white（toolbar / 面板底） |
| `--bragi-surface-muted` | `#f6f6f6` | ~neutral-50 |
| `--bragi-edge-default` | `#d4d4d4` | neutral-300 |
| `--bragi-text` / `--bragi-accent` | `#161616` | ~neutral-900 |
| `--bragi-border` | `#00000012` | 7% 透明黑（非 solid neutral） |

## Dark 模式 · 对照 Tailwind neutral

| Bragi token | 值 | Tailwind 参考 |
|-------------|-----|---------------|
| `--bragi-canvas-bg` | `#191919` | ~neutral-900 |
| `--bragi-surface` | `#404040` | neutral-700（toolbar / 面板） |
| `--bragi-surface-muted` | `#525252` | neutral-600 |
| `--bragi-edge-default` | `#525252` | neutral-600 |
| `--bragi-text` / `--bragi-accent` | `#f0f0f0` | ~neutral-100 |
| `--bragi-border` | `#ffffff12` | 7% 透明白 |

## 浮动 Toolbar

以下组件背景统一为 `--bragi-surface`：

- 画布底部 `.canvas-card-menu`
- 节点选中菜单 `.bragi-canvas-menu`
- 生成条 `.bragi-generate-bar`

Dark 模式下需覆盖 Obsidian 对 `.canvas-card-menu` 的 `--background-secondary` 规则（已在 CSS 中处理）。

## 改色

只改 `src/styles.css` 顶部 token 块；改完后 `cp src/styles.css styles.css` 并同步到 vault。
