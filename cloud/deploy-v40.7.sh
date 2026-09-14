#!/usr/bin/env bash
# =============================================================================
# deploy-v40.7.sh — 一键把 v40.6/v40.7（知乎绑定 + 云端收藏夹）推到阿里云
#
# 前提：本机可访问 ecs.aliyuncs.com，且拥有 RAM AccessKey（云助手 RunCommand 权限）
# 实例：i-bp1047igy284wahculqm（cn-hangzhou，47.114.35.97）
# 通道：云助手 API（SSH 22 已被云安全组封，不可用）
#
# 用法：
#   AK_ID=LTAI5t8DuXUFaZLrcmAq4Lpa AK_SECRET=xxxxxxxx bash cloud/deploy-v40.7.sh
#
# 可选环境变量：
#   NODE=/path/to/node   指定 node（默认 node）
#   SKIP_FRONTEND=1      跳过前端整包，只推服务端
# =============================================================================
set -euo pipefail

: "${AK_ID:?请设置 AK_ID（RAM AccessKeyId）}"
: "${AK_SECRET:?请设置 AK_SECRET（RAM AccessKeySecret）}"

# 注意：Windows 版 node 不认 Git Bash 的 /d/... 挂载路径，必须用 pwd -W 取 D:/... 形式
ROOT="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
NODE="${NODE:-node}"
TARBALL="$ROOT/cloud/mbti-cloud-build-v40.7.tar.gz"
INSTANCE="i-bp1047igy284wahculqm"
PUBLIC="http://47.114.35.97:3001"

# 服务端需要更新的文件（相对 server/）
SERVER_FILES=(
  db.js
  index.js
  routes/favorites.js
  routes/zhihu-auth.js
  utils/secret-box.js
  utils/zhihuUserApi.js
)

run() { AK_ID="$AK_ID" AK_SECRET="$AK_SECRET" "$NODE" "$ROOT/cloud/runcmd.js" "$1" "$INSTANCE"; }
push() { AK_ID="$AK_ID" AK_SECRET="$AK_SECRET" "$NODE" "$ROOT/cloud/file-push.js" "$1" "$2" "$INSTANCE"; }
# 云助手回显尾部常带空行，取「最后一个非空行」（awk 恒返回 0，配合 pipefail 安全）
lastline() { tr -d '\r' | awk 'NF{last=$0} END{print last}'; }

echo "════════════════════════════════════════════════════════"
echo "  v40.7 云端部署  →  $INSTANCE"
echo "════════════════════════════════════════════════════════"

# ── 0) 探测云端目录结构（不猜路径） ─────────────────────────────
echo "==> [0/6] 探测云端目录结构"
WD="$(run "systemctl show -p WorkingDirectory --value mbti-debate" | lastline)"
BUILD_DIR="$(run "dirname \$(systemctl show -p WorkingDirectory --value mbti-debate)" | lastline)"
echo "    服务端目录 WD      = $WD"
echo "    应用根目录 BUILD_DIR = $BUILD_DIR"
if [ -z "$WD" ] || [ "$WD" = "-" ]; then
  echo "!! 未探测到 WorkingDirectory，请先确认 mbti-debate.service 存在" >&2
  exit 1
fi

# ── 1) 前端整包 ────────────────────────────────────────────────
if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
  echo "==> [1/6] 部署前端整包（$(basename "$TARBALL")）"
  AK_ID="$AK_ID" AK_SECRET="$AK_SECRET" "$NODE" "$ROOT/cloud/cloud-deploy.js" "$TARBALL" "$INSTANCE"
else
  echo "==> [1/6] 跳过前端"
fi

# ── 2) 服务端文件 ──────────────────────────────────────────────
echo "==> [2/6] 推送服务端文件 → $WD"
# 远端逐级建目录（utils/ 之类子目录首次部署时不存在，否则重定向会失败 → ERR cmd failed）
for f in "${SERVER_FILES[@]}"; do
  SUB="$(dirname "$f")"
  [ "$SUB" = "." ] || run "mkdir -p $WD/$SUB" >/dev/null
done
for f in "${SERVER_FILES[@]}"; do
  echo "    · $f"
  push "$ROOT/server/$f" "$WD/$f"
done

# ── 3) ZHIHU_COOKIE_KEY（仅在缺失时添加，避免覆盖导致已绑定 cookie 失效） ──
echo "==> [3/6] 确保 ZHIHU_COOKIE_KEY 存在"
KEY_ABSENT="$(run "grep -q '^ZHIHU_COOKIE_KEY=' $BUILD_DIR/.env && echo NO || echo YES" | lastline)"
if [ "$KEY_ABSENT" = "YES" ]; then
  # 用 base64 传递，规避 Git Bash 引号转义问题
  NEWKEY="$("$NODE" -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,48))")"
  B64="$(printf '%s' "$NEWKEY" | base64 -w0)"
  # ⚠️ 老 .env 末行常无换行 → 直接 >> 会拼到上一行（如 ADMIN_TOKEN=ZHIHU_COOKIE_KEY=...）
  #    先补一个换行再追加
  run "printf '\nZHIHU_COOKIE_KEY=%s\n' \"\$(echo $B64 | base64 -d)\" >> $BUILD_DIR/.env && grep -c '^ZHIHU_COOKIE_KEY=' $BUILD_DIR/.env"
  echo "    已写入新的 ZHIHU_COOKIE_KEY（48 位随机）"
else
  echo "    ZHIHU_COOKIE_KEY 已存在，保持不变"
fi

# ── 4) 重启 ────────────────────────────────────────────────────
echo "==> [4/6] 重启 mbti-debate.service"
run "systemctl restart mbti-debate && sleep 5 && systemctl is-active mbti-debate"

# ── 5) 本机侧验证 ──────────────────────────────────────────────
echo "==> [5/6] 本机侧验证（公网）"
sleep 3
VER="$(curl -s -m 15 "$PUBLIC/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)"
echo "    前端版本 = ${VER:-<无>}"
# 真实 GET 端点应返回 401 JSON；若返回 200 text/html = 被 SPA 兜底吞掉 = 未注册
for ep in favorites favorites/tags favorites/check zhihu-auth/me zhihu-auth/favlists zhihu-auth/sync-log; do
  out="$(curl -s -m 12 -w '\n%C%{http_code}|%{content_type}' "$PUBLIC/api/$ep")"
  code="$(printf '%s' "$out" | sed -n 's/.*%\([0-9]*\)|.*/\1/p' | tail -1)"
  ct="$(printf '%s' "$out" | sed -n 's/.*%[0-9]*|//p' | tail -1)"
  mark="✓"; case "$ct" in text/html*) mark="✗ 被SPA兜底(未注册)";; esac
  printf "    %-26s -> %s  %s\n" "/api/$ep" "$code" "$mark"
done
echo "    GET  /api/health -> $(curl -s -m 10 "$PUBLIC/api/health")"

# ── 6) 服务端体检 ──────────────────────────────────────────────
echo "==> [6/6] 云端内部体检（journalctl 有无报错）"
run "journalctl -u mbti-debate -n 20 --no-pager | grep -iE 'error|fatal|crash|EADDR' | tail -5 || echo 'NO_ERROR'" || true

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ 完成。版本应变为 index-DNriWZLH.js"
echo "  若 POST /api/favorites 仍 404，说明服务端文件未落到 WD 目录。"
echo "════════════════════════════════════════════════════════"
