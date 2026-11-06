<div align="center">

<img src="public/favicon.svg" width="76" height="76" alt="CodeCard" />

# CodeCard

**输入一段代码或一段笔记，一键生成可以发朋友圈的技术卡片。**

12 套模板 · 6 套代码高亮主题 · 中文排版自动优化 · 导出高清 PNG

一个文件双击就用，不登录、不上传、不加任何水印

</div>

![CodeCard 预览](public/og-image.png)

## 特性

- **六种卡片类型**：知识卡片（Markdown）、代码片段（高亮）、命令行输出、数学公式、名言金句、自定义
- **12 套模板**：终端黑、极客蓝、极简白、VS Code、渐变紫、粉色甜心、森林绿、星空夜、杂志风、海报风、手写风、现代简约
- **六套高亮主题**：One Dark、Monokai、GitHub Light、Dracula、Solarized、Nord
- **中文排版**：中英文之间自动加空格、全角标点统一、代码里的中文注释正常渲染
- **高清导出**：1x / 2x / 3x 三档，最大 3240×3240，无白边；也支持一键复制到剪贴板、导出 SVG
- **三种尺寸**：正方形 1080×1080、横版 1200×630、竖版 1080×1920
- **纯本地**：所有数据留在浏览器 localStorage，不联网、不上传

## 直接用

不想装环境的话，拿 Release 里的 `codecard-1.0.0.html`，双击打开就能用 —— 一个文件、223KB、零请求。

它和开发时的页面是同一份代码，只是预先内联成单文件：脚本、样式、图标全在里面，`file://` 下也没有任何跨域请求可被拦。

## 快速开始

```bash
npm install
npm run dev              # 开发
npm run build            # 生产构建（静态站点，dist/）
npm run build:standalone # 单文件构建（dist-standalone/index.html）
npm run check:standalone # 用真实 Chromium 以 file:// 打开单文件产物验收
npm run release          # 两种构建 + 验收 + 打包到 release/
npm run test             # 单元测试（jsdom）
npm run test:e2e         # 浏览器端 E2E（真实 Chromium，首次需 npx playwright install chromium）
npm run typecheck        # 类型检查
```

### 为什么有两个 build

`npm run build` 产出 ESM + 按需加载的模板 chunk，也就是常规静态站点，适合挂服务器。

但它**不能双击打开**：`file://` 下 module 脚本按 CORS 取，origin 是 `null`，浏览器一律拒绝，白屏。

`npm run build:standalone` 换成 IIFE、动态 import 内联、资源全塞进 HTML，才有「一个文件、双击可用」。两条产物在 CI 里都验，`check:standalone` 那条会真的用 Chromium 打开 `file://` 并导出一次。

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

### 多尺寸实拍

同一套内容在三种画布下的真实导出结果（点开看原图）：

| 模板 | 正方形 1080 | 横版 1200×630 | 竖版 1080×1920 |
| --- | --- | --- | --- |
| 终端黑 | ![](docs/screenshots/terminal-black-square.webp) | ![](docs/screenshots/terminal-black-landscape.webp) | ![](docs/screenshots/terminal-black-portrait.webp) |
| 极简白 | ![](docs/screenshots/minimal-white-square.webp) | ![](docs/screenshots/minimal-white-landscape.webp) | ![](docs/screenshots/minimal-white-portrait.webp) |
| 渐变紫 | ![](docs/screenshots/gradient-purple-square.webp) | ![](docs/screenshots/gradient-purple-landscape.webp) | ![](docs/screenshots/gradient-purple-portrait.webp) |
| 海报风 | ![](docs/screenshots/poster-square.webp) | ![](docs/screenshots/poster-landscape.webp) | ![](docs/screenshots/poster-portrait.webp) |
| 星空夜 | ![](docs/screenshots/starry-night-square.webp) | ![](docs/screenshots/starry-night-landscape.webp) | ![](docs/screenshots/starry-night-portrait.webp) |

全部 12 套 × 3 种尺寸的截图在 `docs/screenshots/`，文件名是 `{模板}-{尺寸}.webp`。

## 技术实现

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3 + TypeScript | `<script setup>` + 组合式函数 |
| 构建 | Vite 6 | 模板按需异步加载，首屏 130KB 左右 |
| 样式 | Tailwind CSS 3 | 设计令牌走 `tailwind.config.ts` |
| 导出 | 自研 DOM → Canvas | 不走 html2canvas，体积小、结果可预测 |
| 高亮 | 手写分词器 | 按行输出 token，行号对齐稳、截图不抖 |
| 测试 | Vitest + jsdom | 227 个用例 |
| E2E | Vitest + Playwright | 37 个浏览器用例 |

### 为什么不用 html2canvas

导出走的是自研渲染器 `src/utils/dom-to-image.ts`：按计算样式逐节点画到 Canvas，原生支持渐变、圆角、边框、SVG 装饰。

几个必须踩的坑都写在代码注释里：

- **预览缩放**：预览区对卡片做了 `transform: scale()`，`getBoundingClientRect()` 拿到的是缩放后尺寸，要用 `cssScale` 折算回设计尺寸，否则导出内容错位
- **渐变坐标系**：Canvas 渐变的坐标是绝对像素，元素不在原点时必须按元素位置偏移，否则渐变跑偏、边缘露黑
- **CSS 渐变角度**：`0deg` 朝上、顺时针，渐变线过长中心，长度按 `|w·sinθ| + |h·cosθ|` 算
- **flex 容器子项**：`<span>` 在 `display: flex` 的父级里要按块级处理，否则整段文字被合并绘制、间距丢失
- **四条边各自画**：边框不能按 `border-top` 一刀切。引用块的竖线是 `border-left`，只看上边框就会整条丢掉；四边宽度不同时 `strokeRect` 也表达不出来，得逐边填矩形
- **行内代码的零宽断点**：正文里的 `Object.\u200Bdefine\u200BProperty` 会让浏览器把散字量成好几截窄条，照抄过来就是一堆碎字。这种情况按块宽自己重排，行内元素仍按各自的行盒裁切绘制
- **行宽不能用行盒量**：行内元素跨行时每行一个矩形，都短于真正能排字的宽度；量不到元素宽度时退回"这一块最宽的行盒"
- **SVG 的 `d` 属性不认百分比**：`M0 62% L 100% 42%` 是语法错，浏览器整条路径判长度 0、一个字都不报给应用，控制台只留一句 `<path> attribute d: Expected number`。卡片照样能导出，测试照样全绿。装饰路径一律写像素坐标

### 内容自适应

12 套模板都接了 `useAutoFit`（`src/composables/useAutoFit.ts`）：内容多就缩字号收纳，内容少就放大填满，同一段文字在正方形、横版、竖版下都不会被裁掉或空掉半张卡。

字号是响应式数据，改动后必须等 Vue 更新到 DOM 才能测量，所以全部走异步循环（每次 `await nextTick()`）—— 同步读 `getComputedStyle` 只会拿到上一帧的旧值。

有两点踩过坑，写在这里免得再踩：

- **不能用 `clientHeight` 当上限**：容器本身会被 flex 压小，它当前的高度只是「被压之后的样子」，按它算会一直判为溢出、一路缩到下限。要量内容的自然高度，再跟容器能给出的空间比
- **`clientHeight` 是取整的**：断行按整字算、行末标点在行盒外，估出来的高度总比实际乐观一点，所以缩放档位要留 6% 余量，再逐档往下试，而不是一步切到「刚好放下」

放大不是无脑填满，有三道闸：

- **每行最少字数**：放大后一行仍要有 16 个字，否则窄卡片会把句子排成一列字
- **横向溢出**：`scrollWidth` 查不出行内元素（行内代码、`<wbr>` 片段）的溢出，得用 `Range.getClientRects()` 量真实行盒
- **中文避头尾**：标点不能掉在行首，末行也不能只剩一个标点

最后一条最麻烦。浏览器的 `line-break: strict` 拦不住中文逗号跑到行首，而 `Range` 也量不出来 —— 行末标点会被浏览器悬挂到行盒之外，位置仍归属上一行。所以这里用 `measureText` 逐字累加宽度，自己把贪心断行模拟一遍，再据此判断档位干不干净。

### 长标识符断行

`Object.defineProperty` 这类长标识符不要从中间劈开。做法是在 `.`、`_`、`/` 之后和驼峰边界插入零宽空格（`src/utils/typography.ts` 的 `breakPoints`），换行时优先在这些位置断开。

零宽空格比 `<wbr>` 稳：`<wbr>` 只提供一个断点，片段本身超宽时浏览器仍会从中间硬拆。

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

## 测试

两层，各管一段：

- **`npm run test`** —— jsdom 里的单元测试，227 个用例。导出渲染器的绘制逻辑靠伪造 `getBoundingClientRect` + 假 Canvas 上下文录调用断言
- **`npm run test:e2e`** —— 真实 Chromium，37 个用例。自适应缩放、导出像素、圆角/透明度/水印、中文断行这些**依赖真实排版和真实画布**的东西只能在这里验，jsdom 里 `measureText` 恒返回 0，测出来是自欺欺人

单测覆盖：导出渲染器（渐变坐标换算、圆角裁剪、边框内缩、换行与对齐、flex 子项不粘连、缩放折算、SVG 装饰加载失败兜底）、12 套模板 × 6 种卡片类型全组合渲染、预览容器自动缩放比例与重测量。

E2E 覆盖：**SVG 路径全部有几何长度且装饰真的进了导出图、导出 SVG 的尺寸与内容**、12 套模板 × 3 种尺寸的长文不裁切、横竖版字号真的变、长标识符不在中间劈开、1x/2x/3x 导出尺寸、四边无缝隙、深色模板文字真的画出来了、行内代码与加粗混排不重复绘制、引用块竖线真的画出来了（单侧边框）、长标题在词边界换行不被劈开、**圆角/背景透明度/水印在导出图里真的生效**。CI 里 `npm ci` 之后需要 `npx playwright install --with-deps chromium`。

### 导出 SVG

`src/utils/svg-export.ts` 没有另写一套绘制逻辑：仍然走 `renderElementToCanvas` 画一遍，把画好的位图整张裹进 `<image>`。**好处是「所见即所导」自动成立** —— 两套渲染器迟早会漂移，而 SVG 只是同一个产物的另一种封装。

内嵌用**JPEG 不用 PNG**：卡片是照片式的大面积渐变，1080 见方的 PNG 要 990KB，JPEG(0.94) 只要 160KB，肉眼看不出差别，而 base64 还要再涨三分之一。2x 导出时是 2.16MB 对 1MB。

两个已知代价，别当成 bug：

- **图里没有可选中的矢量字形**。真矢量字体得逐字转 path，是另一个量级的工程
- **JPEG 没有 alpha 通道**，背景透明度 < 100% 时透明区会被合成成白底。要先合成再编码，否则透明处是黑的

## 样式面板与导出

样式面板不自己改 `props.style`，所有改动都走 `update:style` 事件交给 `useCardEditor.patchStyle`。

**别写 `props.style.xxx = v`** —— props 代理只对「整个对象赋值」才转发给父级，改属性会打在一份拷贝上：读得到、写不进去，`toRef(props, 'style')` 和解构出来也是同一层代理。踩过一次：圆角、背景透明度、水印整组开关点了都没反应，单测和 E2E 全绿，因为没人验过改完之后的导出图。

导出时 `background: 'transparent'`，**不垫白底**：背景透明度调到 0 是要把卡片叠到别的东西上，这时候导出图就该是透明底。

由此带来两个渲染器细节：

- **圆角只裁这一层自己的背景和描边**，不裁子树 —— 浏览器不会因为 `overflow: hidden` 就重新断行，正文得按未裁剪的区域排
- **SVG 装饰按「包含它的那层祖先」的圆角再裁一次**（多裁 1px）。光栅化半径是整数近似，圆角边缘会残留一圈半透明的直角像素，不处理的话四角是方的

## 开发约定

- 提交前跑 `npm run typecheck && npm run test && npm run build && npm run test:e2e`
- 卡片尺寸一律用设计像素计算，不依赖预览缩放，保证导出与所见一致
- 新增模板：在 `src/components/preview/templates/` 建组件，再到 `src/utils/templates.ts` 注册（含 `loader`、`defaultStyle`、`suits`）

## 已知的边界

这几条是**设计上限**，不是待修的 bug。写在这里，是因为它们大多是「看起来像 bug」：

### 内容太多时，字号会停在下限

`MIN_SCALE = 0.28` 是相对基础字号的倍率（默认 36px × 0.28 ≈ 10px）。超过这个内容量，再长的文字也不会更小 —— 10px 已经是 1200×630 画布上的可读下限，继续缩不如换版式（拆成两张、或改用竖版）。此时内容会溢出，导出图照样完整，只是超出画布的部分会被裁掉。

### 等长段落可能留白

字号是整数。六段等长的中文刚好卡在「13px 每段一行、14px 全体两行」之间时，跨不过去的那一档只能选小的，于是底部留白三成。这是量化瓶颈，不是算法没往上补 —— 段长长错开的真实笔记不会遇到。

### 「每行至少 16 字」会挡住短内容放大

一段十几个字的短句，即使版心还有大量空间也不会放得更大：再大就排成一列字了。宁可留白。

### 数学公式是自研渲染，不是完整 LaTeX

`src/utils/latex.ts` 覆盖技术卡片常见的写法：分式、根式、上下标、求和/积分上下限、希腊字母、`\text{}`、`cases` 环境。`\matrix`、`\begin{aligned}` 的对齐、自定义宏、`\color` 这些不支持 —— 遇到不认识的命令会印出命令名，不会露出反斜杠，也不会崩。

没引 KaTeX/MathJax 是刻意的：卡片是纯本地离线的单文件产物，为几十个公式塞进几百 KB Web Font 不划算。

## 排查时踩过的一个假象

有时候（1440×900 桌面视口、普通 headless Chromium 都会撞上）在卡片里临时插入元素并读 `Range.getClientRects()`，会读到「没换行」的错误结果：990px 宽、10px 字号量出 558px 一个行盒，高度还被截成 6.2px。

同样的代码放在 `<body>` 直下、或者把祖先的 `transform: scale()` 去掉，立刻正确。这是浏览器侧的时序/缓存问题，不是排版代码算错 —— 所以**别照着这种读数去改排版**，那些数字是假的。

## 中文排版

`src/utils/typography.ts` 只有两条规则，都由「两个相邻字符是什么」决定：

- `needsGap(a, b)` —— 拉丁「词」与汉字相邻时补一个空格
- `keepSpace(a, b)` —— 原文里已有的空格要不要留

第二条的原则是**用户敲的空格默认是对的**：只有半角括号紧贴汉字（`函数 )`）这种规则说得清的地方才收。旧实现反过来，只要有一侧是汉字、`needsGap` 又没判定要补，就一律收掉 —— `100% 以上`、`C++ 和`、`Hello, 世界` 里的空格全被吃掉，一句话里同一个词还能排出两种样子。

「拉丁词」的边界也不能只看 `[A-Za-z0-9]`。`%` `+` 是收尾符（`100%`、`C++`），`$` `#` `@` 是开头符（`$10`、`#1`、`@user`），两者混成一个字符集会排出 `# 标签`，所以要分开定义。

剩下的交给 `spaceUnits()`：所有内容先展开成「排版单元」流（普通文字逐字符，行内代码/加粗/链接整块不拆），逐个单元判定边界，连续空白压成一个，首尾空格去掉。

这里有个必须踩对的点：**判定「是不是汉字」的范围不能太大**。旧实现把 `\u2e80-\u9fff` 和 `\uff00-\uffef` 都算作汉字，全角标点于是被当成了汉字 —— `汉)。` 里 `)` 与 `。` 之间被判定成「汉字 + 汉字」，补出 `汉) 。`。现在的范围是 `\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff`，只含汉字本体。

行内标记是另一层坑。旧做法是「先把整段跑一遍 pangu，再切标记」，可标记符号一去掉就没了：`**Proxy**复写` 切成 `**Proxy**` + `复写` 之后，补空格时看到的是两个独立片段，判定不出来。现在先切 token，再把「标记内容的首尾字符」当成不透明单元参与边界判定，补出来的空格记在 `tok = -1` 上，聚回节点时不会丢。
