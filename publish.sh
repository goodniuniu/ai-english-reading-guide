#!/usr/bin/env bash
# 一键发布：重建线上文章库 → 提交 → 推送到 GitHub（Pages 自动更新，约 1 分钟后生效）
set -e
cd "$(dirname "$0")"

echo "[1/3] 运行 build.js 重建线上文章库 assets/articles.js"
node build.js

echo "[2/3] git add + commit"
git add -A
git commit -m "publish: update reading library ($(date '+%Y-%m-%d %H:%M'))" || echo "无新变更，跳过提交"

echo "[3/3] git push"
git push

echo "✔ 已发布。GitHub Pages 约 1 分钟后自动更新。"
