# beat-promo-director

**把一份 `storyboard.json` 变成 10–40 秒、音乐卡点、大字排版的 1920×1080 宣传片。**
渲染引擎、配乐合成器、字体、特效都已写好在 `kit/` 里 —— AI 只当导演，不搭管线。

An agent skill for **beat-synced kinetic-typography promo videos**: write a storyboard, synthesize an original score in code, validate and render with HyperFrames, then self-review the sampled frames. No stock footage, no material downloads, no from-scratch rendering pipeline.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 这是什么

- **给 agent 用的「导演」技能**：技能只规定创作流程和硬性约束，把渲染、配乐、校验都交给现成工具。
- **kit 里已经有的东西**：
  - `build.mjs` —— 分镜校验 + 生成渲染工程（`index.html`）
  - `make-music.mjs` —— 纯代码合成原创配乐（含逐帧频谱，供画面跟音乐联动）
  - `review.mjs` —— 按分镜抽帧，生成 contact sheet 供 `read_image` 自检
  - `runtime.js` —— 10 种场景类型：`prompt` `codeCrawl` `wordCuts` `counter` `brushSlam` `spectrum` `tileFlip` `whisper` `titleLockup` `credits`
  - `kit/fonts/` —— 6 款已授权字体（黑体/宋体/手写/等宽）
  - 18 种合成音效 + 6 个和弦（`Dm` `Bb` `F` `C` `A` `Gm`）
- **硬规则内建**：120 BPM、16 分音符时间网格、小节线切场景、画面冲击必须有同刻音效、每屏大字 ≤ 6 字。
- **不做什么**：不自建 puppeteer 截帧、不自拼 ffmpeg 管线、不画角色、不下载任何素材或音乐。

## 环境要求

| 依赖 | 用途 | 获取 |
|---|---|---|
| Node.js ≥ 22 | 跑 kit 与 HyperFrames | <https://nodejs.org> |
| ffmpeg / ffprobe | HyperFrames 渲染与时长校验 | `winget install --id Gyan.FFmpeg -e` / 包管理器 |
| `npx hyperframes` | 渲染器（首次会准备 headless 浏览器） | 由 npx 自动拉取 |

国内网络提示（实测在线下载 Chromium / ffmpeg 容易卡住）：

```powershell
# 指向本机已有的 Chrome / Edge / Playwright 的 chrome-headless-shell.exe
$env:HYPERFRAMES_BROWSER_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
# 指向本机已有的 ffmpeg
$env:HYPERFRAMES_FFMPEG_PATH = (Get-Command ffmpeg).Source
$env:HYPERFRAMES_FFPROBE_PATH = (Get-Command ffprobe).Source
```

单个后台下载超过 3 分钟没进展就取消，改用上面的本机路径方案。

## 安装

### 方式 A：DSH（DeepSeek Harness）全局安装

```powershell
# Windows PowerShell
git clone https://github.com/kuaizengji/beat-promo-director "$HOME\.dsh\skills\beat-promo-director"
```

```bash
# macOS / Linux
git clone https://github.com/kuaizengji/beat-promo-director ~/.dsh/skills/beat-promo-director
```

或用仓库内的安装脚本（会按需覆盖，可选追加全局规则）：

```powershell
.\install.ps1              # 安装到 %USERPROFILE%\.dsh\skills
.\install.ps1 -WithRules   # 同时把 AGENTS.example.md 的规则并入 %USERPROFILE%\.dsh\AGENTS.md（原文件自动备份）
.\install.ps1 -Force       # 已存在时覆盖
```

```bash
./install.sh               # 安装到 ~/.dsh/skills
./install.sh --with-rules  # 同时追加规则到 ~/.dsh/AGENTS.md
```

> `AGENTS.example.md` 里的规则只是「让 agent 一看到视频需求就自动加载本技能」的便捷开关，不装也能用。

### 方式 B：只对某个项目生效

```powershell
New-Item -ItemType Directory -Force "<项目>\.dsh\skills" | Out-Null
git clone https://github.com/kuaizengji/beat-promo-director "<项目>\.dsh\skills\beat-promo-director"
```

DSH 会同时扫描项目级 `<project>/.dsh/skills` 和用户级 `~/.dsh/skills`，项目级优先。

### 其他 harness

任何读取 `SKILL.md` frontmatter + 资源目录的 skill 机制都能用，例如 Claude Code 放进 `~/.claude/skills/beat-promo-director/`；再把 `AGENTS.example.md` 的规则放进项目的 `AGENTS.md` / `CLAUDE.md` 即可。

## 使用

技能加载后，`<SKILL_DIR>` 是它自己的绝对路径。四步走：

**0. 检查环境（一次）**

```powershell
node -v
ffmpeg -version
npx --yes hyperframes@latest browser ensure
```

**1. 写分镜 `storyboard.json`（最重要）**

先读 `references/scene-catalog.md`、`references/style-rules.md`，参考 `examples/storyboard.example.json`。硬性要求见 `SKILL.md`：`bpm: 120`、时间点必须是 0.125 的整数倍、场景 1.5–2.5 秒且首尾相接、切换落在小节线、`hits` 与 `fx.shakes` 一一对应、`music.sections` 走 intro → groove → build → **drop** → break → finale → outro。

**2. 生成音乐与工程**

```powershell
node "<SKILL_DIR>/kit/make-music.mjs" storyboard.json assets/bgm.wav
node "<SKILL_DIR>/kit/build.mjs" storyboard.json
npx --yes hyperframes@latest check .
```

`build.mjs` 报 ✗ 必须先修；`check` 里 Layout 的 ✗（文字重叠/出框）必须修，Contrast 对 HUD 的提醒可忽略。

**3. 抽帧自检（不能跳过）**

```powershell
node "<SKILL_DIR>/kit/review.mjs" storyboard.json
```

生成 `review/contact-sheet-*.jpg`，用 `read_image` 逐张看，对照 `references/review-checklist.md` 列问题清单，只改有问题的场景参数或时间，重新 build + review。至少一轮，最多三轮。

**4. 渲染与交付**

```powershell
npx --yes hyperframes@latest render . -o out/video.mp4 --fps 30
ffprobe -v error -show_entries format=duration -of csv=p=0 out/video.mp4
```

## 目录结构

```
beat-promo-director/
├── SKILL.md                     # 技能正文：流程 + 硬性约束（agent 读这个）
├── AGENTS.example.md            # 可选的全局/项目规则模板
├── install.ps1 / install.sh     # 一键安装脚本
├── references/
│   ├── scene-catalog.md         # 10 种场景类型与参数
│   ├── style-rules.md           # 排版、配色、动效风格规范
│   └── review-checklist.md      # 抽帧自检清单
├── examples/
│   └── storyboard.example.json  # 完整分镜示例
├── kit/
│   ├── build.mjs                # 分镜校验 + 生成工程
│   ├── make-music.mjs           # 原创配乐合成器
│   ├── review.mjs               # 抽帧 + contact sheet
│   ├── runtime.js               # 场景渲染运行时
│   ├── gsap.min.js              # 动画库（见第三方许可）
│   └── fonts/                   # 6 款已授权字体
└── THIRD_PARTY_LICENSES.md
```

## storyboard.json 速览

```json
{
  "title": "…", "bpm": 120, "duration": 20, "fps": 30, "hud": "CODE → CINEMA",
  "palette": { "ink": "#07070a", "paper": "#f3efe6", "accent": "#ff3b24", "grey": "#8a8894" },
  "music": { "sections": [], "chords": [], "lead": [], "koto": [], "stabs": [] },
  "hits": [ { "t": 8.0, "sfx": "mega" } ],
  "scenes": [ { "id": "s-intro", "type": "prompt", "start": 0, "end": 2, "params": {} } ],
  "fx": { "flashes": [], "flashIn": [], "shakes": [], "blackouts": [], "fadeOutAt": 19.5 }
}
```

完整字段与场景参数见 `examples/storyboard.example.json` 和 `references/scene-catalog.md`。

## 第三方资源

`kit/` 内嵌了第三方资产，均以原许可再分发，详见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)：

- GSAP 3.15.0 —— GreenSock 标准许可
- Ma Shan Zheng（手写体）—— SIL OFL 1.1
- Noto Sans CJK SC Light / Black、Noto Serif CJK SC Black —— SIL OFL 1.1
- DejaVu Sans Mono Book / Bold —— Bitstream Vera 字体许可

本仓库原创的代码、文档与分镜模板以 MIT 许可发布。

## License

[MIT](LICENSE) © 2026 kuaizengji
