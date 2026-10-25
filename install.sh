#!/usr/bin/env bash
# 安装 beat-promo-director 技能（默认：DSH 用户级全局目录 ~/.dsh/skills）
set -euo pipefail

DEST="${DSH_SKILLS_DIR:-$HOME/.dsh/skills}"
WITH_RULES=0
FORCE=0

usage() {
  cat <<'EOF'
用法: ./install.sh [选项]
  --dest=<dir>       安装到指定 skills 目录（默认 $HOME/.dsh/skills）
  --with-rules       把 AGENTS.example.md 的规则追加到 ~/.dsh/AGENTS.md（先备份）
  --force            目标已存在时覆盖
  -h, --help         显示帮助
EOF
}

for arg in "$@"; do
  case "$arg" in
    --with-rules) WITH_RULES=1 ;;
    --force) FORCE=1 ;;
    --dest=*) DEST="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$DEST/beat-promo-director"

if [ -e "$TARGET" ]; then
  if [ "$FORCE" = 1 ]; then
    rm -rf "$TARGET"
  else
    echo "目标已存在：$TARGET（加 --force 覆盖）" >&2
    exit 1
  fi
fi

mkdir -p "$TARGET"
for item in SKILL.md kit references examples; do
  cp -R "$SRC/$item" "$TARGET/"
done
echo "✓ 已安装技能 -> $TARGET"

if [ "$WITH_RULES" = 1 ]; then
  RULES_FILE="$HOME/.dsh/AGENTS.md"
  mkdir -p "$(dirname "$RULES_FILE")"
  if [ -f "$RULES_FILE" ]; then
    BACKUP="$RULES_FILE.bak-$(date +%Y%m%d%H%M%S)"
    cp "$RULES_FILE" "$BACKUP"
    echo "已备份原规则 -> $BACKUP"
    printf '\n' >> "$RULES_FILE"
    cat "$SRC/AGENTS.example.md" >> "$RULES_FILE"
  else
    cp "$SRC/AGENTS.example.md" "$RULES_FILE"
  fi
  echo "✓ 已写入规则 -> $RULES_FILE"
fi

echo ""
echo "下一步：node -v && ffmpeg -version && npx --yes hyperframes@latest browser ensure"
