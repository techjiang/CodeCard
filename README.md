<div align="center">

<img src="public/favicon.svg" width="76" height="76" alt="CodeCard" />

# CodeCard

**输入一段代码或一段笔记，一键生成可以发朋友圈的技术卡片。**

12 套模板 · 6 套代码高亮主题 · 中文排版自动优化 · 导出高清 PNG

打开即用，不登录、不上传、不加任何水印

</div>

![CodeCard 预览](public/og-image.png)

## 特性

- **四种卡片类型**：知识卡片（Markdown）、代码片段（高亮）、命令行输出、数学公式、名言金句
- **12 套模板**：终端黑、极客蓝、极简白、VS Code、渐变紫、粉色甜心、森林绿、星空夜、杂志风、海报风、手写风、现代简约
- **六套高亮主题**：One Dark、Monokai、GitHub Light、Dracula、Solarized、Nord
- **中文排版**：中英文之间自动加空格、全角标点统一、代码里的中文注释正常渲染
- **高清导出**：1x / 2x / 3x 三档，最大 3240×3240，无白边；也支持一键复制到剪贴板
- **三种尺寸**：正方形 1080×1080、横版 1200×630、竖版 1080×1920
- **纯本地**：所有数据留在浏览器 localStorage，不联网、不上传

## 快速开始

```bash
npm install
npm run dev        # 开发
npm run build      # 生产构建
npm run test       # 单元测试
npm run typecheck # 类型检查
```

## 模板一览

| 模板 | 适合 | 预览 |
| --- | --- | --- |
| 终端黑 | 代码、命令行 | ![](docs/screenshots/t-terminal-black.webp) |
| 极客蓝 | 代码、知识卡 | ![](docs/screenshots/t-geek-blue.webp) |
| 极简白 | 代码、长文 | ![](docs/screenshots/t-minimal-white.webp) |
| VS Code | 代码 | ![](docs/screenshots/t-vs-code.webp) |
| 渐变紫 | 知识卡、金句 | ![](docs/screenshots/t-gradient-purple.webp) |
| 粉色甜心 | 知识卡、分享 | ![](docs/screenshots/t-pink-sweet.webp) |
| 森林绿 | 知识卡、笔记 | ![](docs/screenshots/t-forest-green.webp) |
| 星空夜 | 公式、金句 | ![](docs/screenshots/t-starry-night.webp) |
| 杂志风 | 长文、专栏 | ![](docs/screenshots/t-magazine.webp) |
| 海报风 | 观点、金句 | ![](docs/screenshots/t-poster.webp) |
| 手写风 | 随笔、金句 | ![](docs/screenshots/t-handwrite.webp) |
| 现代简约 | 通用 | ![](docs/screenshots/t-modern-simple.webp) |

## 技术实现

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3 + TypeScript | `<script setup>` + 组合式函数 |
| 构建 | Vite 6 | 模板按需异步加载，首屏 130KB 左右 |
| 样式 | Tailwind CSS 3 | 设计令牌走 `tailwind.config.ts` |
| 导出 | 自研 DOM → Canvas | 不走 html2canvas，体积小、结果可预测 |
| 高亮 | 手写分词器 | 按行输出 token，行号对齐稳、截图不抖 |
| 测试 | Vitest + jsdom | 58 个用例，覆盖率 77% |

### 为什么不用 html2canvas

导出走的是自研渲染器 `src/utils/dom-to-image.ts`：按计算样式逐节点画到 Canvas，原生支持渐变、圆角、边框、SVG 装饰。

几个必须踩的坑都写在代码注释里：

- **预览缩放**：预览区对卡片做了 `transform: scale()`，`getBoundingClientRect()` 拿到的是缩放后尺寸，要用 `cssScale` 折算回设计尺寸，否则导出内容错位
- **渐变坐标系**：Canvas 渐变的坐标是绝对像素，元素不在原点时必须按元素位置偏移，否则渐变跑偏、边缘露黑
- **CSS 渐变角度**：`0deg` 朝上、顺时针，渐变线过长中心，长度按 `|w·sinθ| + |h·cosθ|` 算
- **flex 容器子项**：`<span>` 在 `display: flex` 的父级里要按块级处理，否则整段文字被合并绘制、间距丢失

### 内容自适应

正文过长时，杂志风 / 海报风 / 手写风会自动缩小字号收纳（`src/composables/useAutoFit.ts`）。

字号是响应式数据，改动后必须等 Vue 更新到 DOM 才能测量，所以用异步循环逐档试缩 —— 同步读 `getComputedStyle` 只会拿到上一帧的旧值。

## 目录结构

```
src/
├─ components/
│  ├─ editor/        编辑器（内容、样式、模板、颜色、字体、尺寸、标签）
│  ├─ preview/       预览渲染器
│  │  ├─ templates/  12 套模板
│  │  └─ parts/      内容分区（Markdown / 终端 / 公式 / 引用）
│  ├─ code/          代码块与高亮
│  └─ shared/        导出按钮、历史抽屉、主题开关
├─ composables/      编辑器状态、导出、历史、主题、自适应
├─ utils/            排版、高亮、Markdown、导出渲染、模板注册
└─ types/            卡片与导出类型
```

## 隐私

不收集任何数据，不发起任何网络请求。卡片内容、样式和历史记录只存在你自己的浏览器 localStorage 里，最多保留 20 条历史。

## 开发约定

- 提交前跑 `npm run typecheck && npm run test && npm run build`
- 卡片尺寸一律用设计像素计算，不依赖预览缩放，保证导出与所见一致
- 新增模板：在 `src/components/preview/templates/` 建组件，再到 `src/utils/templates.ts` 注册（含 `loader`、`defaultStyle`、`suits`）
