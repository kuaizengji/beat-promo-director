# Third-Party Licenses

本仓库原创内容（`SKILL.md`、`references/`、`examples/`、`kit/*.mjs`、`kit/runtime.js`、`README` 等）以仓库根目录的 MIT 许可发布。
下列第三方组件随仓库一同分发，各自遵循原许可，**不受 MIT 许可覆盖**。

---

## 1. GSAP 3.15.0

- 文件：`kit/gsap.min.js`
- 版权：Copyright 2026, GreenSock. All rights reserved.
- 许可：GreenSock Standard License — <https://gsap.com/standard-license>
- 说明：文件头部的 `@license` 声明与版权notice 原样保留。请在使用前阅读 GreenSock 标准许可条款；如需商业授权或再分发限制说明，以 GreenSock 官方条款为准。

## 2. 字体（`kit/fonts/`）

### 2.1 Ma Shan Zheng

- 文件：`kit/fonts/brush.woff2`
- 版权：Copyright 2018 The MaShanZheng Project Authors (<https://github.com/googlefonts/mashanzheng>)
- 许可：SIL Open Font License 1.1 — <https://scripts.sil.org/OFL>

### 2.2 Noto Sans CJK SC Light / Black

- 文件：`kit/fonts/sans-light.woff2`、`kit/fonts/sans-black.woff2`
- 版权：© 2014–2021 Adobe (<http://www.adobe.com/>)，Noto 项目由 Google 维护
- 许可：SIL Open Font License 1.1 — <https://scripts.sil.org/OFL>

### 2.3 Noto Serif CJK SC Black

- 文件：`kit/fonts/serif-black.woff2`
- 版权：© 2017–2023 Adobe (<http://www.adobe.com/>)，Noto 项目由 Google 维护
- 许可：SIL Open Font License 1.1 — <https://scripts.sil.org/OFL>

### 2.4 DejaVu Sans Mono Book / Bold

- 文件：`kit/fonts/mono.woff2`、`kit/fonts/mono-bold.woff2`
- 版权：Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. DejaVu changes are in public domain.
- 许可：Bitstream Vera Fonts License / DejaVu Fonts License — <https://dejavu-fonts.github.io/License.html>

> OFL 字体的再分发允许保留原版权声明并随附许可；字体名（Reserved Font Name）的修改版本限制请遵守 OFL 1.1 第 3 条。

## 3. 运行时依赖（不随仓库分发，运行时由用户环境提供）

- **HyperFrames**（`npx hyperframes`）：渲染器，遵循其自身许可。
- **Node.js**、**ffmpeg/ffprobe**：遵循各自许可。
- `kit/noise0.png`–`noise3.png`：本仓库配图资源，随 MIT 发布。
