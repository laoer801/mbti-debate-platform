# 无 Docker 的备选部署（Ubuntu/Debian 学生机）
# 用法：把本目录（server/ + build/ + deploy-nodocker.sh）上传到云服务器后：
#   chmod +x deploy-nodocker.sh && sudo ./deploy-nodocker.sh
# 若已有 node ≥20 可跳过第 1 步的安装。
set -e
echo "==> [1/5] 安装 Node 22（含 native 编译工具）"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs build-essential python3
fi
echo "node: $(node -v)"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "==> [2/5] 安装后端依赖（云端 Linux 原生 better-sqlite3）"
cd "$APP_DIR/server"
[ -d node_modules ] || npm install --omit=dev

echo "==> [3/5] 数据目录"
mkdir -p /opt/mbti-data

echo "==> [4/5] 配置（编辑此文件填入知乎密钥）："
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
ZHIHU_ACCESS_SECRET=
EOF
fi
echo "    请编辑 $ENV_FILE 填写 ZHIHU_ACCESS_SECRET（可留空先跑，知乎功能暂不可用）"

echo "==> [5/5] 启动（systemd 守护，开机自启）"
cat > /etc/systemd/system/mbti-debate.service <<EOF
[Unit]
Description=MBTI Debate Platform
After=network.target

[Service]
WorkingDirectory=$APP_DIR/server
EnvironmentFile=$APP_DIR/.env
Environment=PORT=3001
Environment=MBTI_DATA_DIR=/opt/mbti-data
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now mbti-debate.service

echo ""
echo "======================================================"
echo "部署完成！"
echo "  服务器访问:  http://服务器公网IP:3001"
echo "  手机/同学访问: http://服务器公网IP:3001"
echo "  查看状态:   systemctl status mbti-debate"
echo "  查看日志:   journalctl -u mbti-debate -f"
echo "  注意: 先在云控制台【安全组】放行入方向 TCP 3001"
echo "======================================================"
