---
name: beat-promo-director
description: 卡点动态排版宣传片导演（kinetic typography / beat-synced promo / 音乐卡点视频 / 文字动效短片）。当用户要做 10–40 秒、带音乐、卡点剪辑、大字排版、计数、故障闪白等动效的视频时使用。提供现成的场景库、原创配乐合成器、分镜校验、抽帧自检，产出 1920×1080 MP4。不要自己从零搭渲染管线。
---

# beat-promo-director

你是导演，不是渲染工程师。**渲染引擎、配乐合成器、字体、特效都已经写好并验证过**，你的工作是：
写一份好分镜（`storyboard.json`）→ 生成音乐 → 生成工程 → 抽帧自检 → 修改 → 渲染。

> 禁止：自己写 puppeteer 截帧、自己拼 ffmpeg 管线、自己画人物角色、下载任何素材或音乐。
> 这些都是质量下降的主要原因。只用本技能的 kit。

本技能目录记为 `<SKILL_DIR>`（加载本技能后，`skill_resources` 里会给出它的绝对路径；下面命令里的 `<SKILL_DIR>` 都要替换成这个绝对路径）。kit 在 `<SKILL_DIR>/kit`。

## 第 0 步：环境（只检查一次）

```powershell
node -v                 # 需要 >= 22
ffmpeg -version         # HyperFrames 渲染需要
npx --yes hyperframes@latest browser ensure   # 准备无头浏览器
```

**国内网络先看这里**（实测：在线下载 Chromium 和 ffmpeg 常常卡住）：
- 先找本机已有的浏览器，找到就设置 `$env:HYPERFRAMES_BROWSER_PATH` 指向它（Chrome、Edge，或 Playwright 缓存里的 `chrome-headless-shell.exe` 都行），不要干等 `browser ensure`；
- 先找本机已有的完整 ffmpeg（`where.exe ffmpeg`、Playwright 缓存、其他软件自带的），找到就设置 `$env:HYPERFRAMES_FFMPEG_PATH` / `$env:HYPERFRAMES_FFPROBE_PATH`；
- 一个后台下载超过 3 分钟没有进展，就取消，换上面的本机方案。

没有 ffmpeg 时二选一：
- `winget install --id Gyan.FFmpeg -e`（之后需要新开终端才生效）；
- 或在项目里 `npm i -D ffmpeg-static ffprobe-static`（国内可先设 `$env:FFMPEG_BINARIES_URL="https://registry.npmmirror.com/-/binary/ffmpeg-static"`），然后在**每条** hyperframes 命令前加上
  `$env:HYPERFRAMES_FFMPEG_PATH=(node -p "require('ffmpeg-static')"); $env:HYPERFRAMES_FFPROBE_PATH=(node -p "require('ffprobe-static').path"); `

## 第 1 步：写分镜 storyboard.json（最重要的一步）

先读 `<SKILL_DIR>/references/scene-catalog.md` 和 `<SKILL_DIR>/references/style-rules.md`，再参照
`<SKILL_DIR>/examples/storyboard.example.json` 的结构写。硬性要求：

1. `bpm: 120`（一拍 0.5 秒，一小节 2 秒）。**所有时间点必须是 0.125 的整数倍**（16 分音符网格）。
2. `scenes` 首尾相接，从 0 铺到 `duration`；每个场景 1.5–2.5 秒，**一个场景只讲一件事**。
3. 场景切换放在小节线上（0、2、4、6…秒）；重拍（场景内的整拍）放字的出现。
4. 每一个画面冲击（`fx.shakes`）都必须在 `hits` 里有同一时刻的音效；反之，大音效（`mega`/`hit`/`stamp`）也要配冲击或闪白。
5. `music.sections` 用这套结构：intro → groove → build → **drop（最强的画面放这里）** → break（留白，最后 0.25 秒静音 `silenceFrom`）→ finale → outro。
6. 文案：大字每屏 ≤ 6 个字；英文小标签全大写；数字用 `counter` 或 `codeCrawl` 去"数"出来，而不是直接写。
7. 配色只用 `palette` 里的 ink / paper / accent 三色。

## 第 2 步：生成音乐与工程（项目目录里运行）

```powershell
node "<SKILL_DIR>/kit/make-music.mjs" storyboard.json assets/bgm.wav   # 原创配乐 + 逐帧频谱
node "<SKILL_DIR>/kit/build.mjs" storyboard.json                         # 校验分镜 + 生成 index.html
npx --yes hyperframes@latest check .
```

`build.mjs` 报 ✗ 必须先修好；⚠ 提醒逐条看。`check` 里 Layout 的 ✗（文字重叠/出框）必须修，Contrast 对 HUD 的提醒可以忽略。

## 第 3 步：抽帧自检（不能跳过）

```powershell
node "<SKILL_DIR>/kit/review.mjs" storyboard.json
```

它会按分镜挑出每个场景的开头、中段和每次冲击后的瞬间，生成 `review/contact-sheet-*.jpg`。
**用 `read_image` 逐张打开**，对照 `<SKILL_DIR>/references/review-checklist.md` 写出问题清单，
然后**只改有问题的场景参数或时间**，重新 build + review。至少做一轮；最多三轮。

## 第 4 步：渲染与交付

```powershell
npx --yes hyperframes@latest render . -o out/video.mp4 --fps 30
ffprobe -v error -show_entries format=duration -of csv=p=0 out/video.mp4   # 应等于 duration
```

交付时说明：分镜要点、改过哪几处（来自自检）、成片路径与时长。

## storyboard.json 速览

```json
{
  "title": "…", "bpm": 120, "duration": 20, "fps": 30, "hud": "CODE → CINEMA",
  "palette": { "ink": "#07070a", "paper": "#f3efe6", "accent": "#ff3b24", "grey": "#8a8894" },
  "music": { "sections": [...], "chords": [...], "lead": [[t, midi, dur], ...], "koto": [[t, midi], ...], "stabs": [t, ...] },
  "hits":  [ { "t": 8.0, "sfx": "mega" }, ... ],
  "scenes": [ { "id": "s-intro", "type": "prompt", "start": 0, "end": 2, "params": { ... } }, ... ],
  "fx": { "flashes": [[t, 强度, 衰减秒]], "flashIn": [[t, 秒]], "shakes": [[t, 像素, 秒]], "blackouts": [[t0, t1]], "fadeOutAt": 19.5 }
}
```

音效名：`type` `enter` `hit` `boom` `whoosh` `glitch` `blip` `tick` `stamp` `mega` `reverse`（落点前 0.9 秒开始的反向镲，`t` 写落点）`explosion` `clash` `slash` `punch` `dash` `sheath`。
和弦名：`Dm` `Bb` `F` `C` `A` `Gm`。
