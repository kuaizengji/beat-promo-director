# 本项目规则（视频工程）

- 做任何视频、动效片、卡点片之前，先用 skill 工具加载 `beat-promo-director`，严格按它的 4 步执行：写分镜 → 生成音乐与工程 → 抽帧自检 → 渲染。
- 不要自己搭渲染管线（puppeteer 截帧、手写 ffmpeg 拼接等），不要下载任何音乐或图片素材。
- 交付前至少完成一轮抽帧自检：用 read_image 查看 review/contact-sheet-*.jpg，并把发现的问题和修改列出来。
- 成片放在 out/video.mp4。
