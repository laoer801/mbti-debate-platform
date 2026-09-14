# ☁️ MBTI 辩论平台 · 云端部署（大学生免费服务器）

把平台从"本机自用"变成"云端随时访问"——手机、室友、同学打开链接就能玩，数据都存在云服务器上。

---

## 第 0 步 · 申请免费服务器（选一家即可，推荐阿里云）

> ⚠️ 申请必须**你本人操作**（实名 + 学生认证）。准备：身份证/支付宝 + **学信网能查到的学籍**。

### 🥇 首选：阿里云「高校计划」（国内访问最快，真 0 元）
1. 打开 **https://university.aliyun.com/** （用电脑网页端）
2. 注册/登录阿里云（新账号优先）→ 右上角完成 **实名认证**（选支付宝快捷认证，几分钟）
3. 进入页面的 **学生认证** → 对接学信网，验证通过后自动发 **300 元无门槛代金券**（秒到账）
4. 往下进 **学生用券中心**（university.aliyun.com/buycenter）选服务器：
   - 规格选 **2核2G / 系统盘40G** 级别即可（跑本项目绰绰有余）
   - 地域选离你近的（华北/华东）
   - 镜像选 **Ubuntu 22.04**（或 24.04）
   - 结算页自动用券 → **实付 0 元** ✅
5. 设置 root/用户密码 → 完成创建，记下**公网 IP**

### 备选
| 平台 | 内容 | 说明 |
|---|---|---|
| 腾讯云 云+校园 | 学生优惠 10 元/月级 | 也有免费体验活动，流程类似 |
| Oracle Cloud Always Free | **永久免费** 4核24G | 免学生认证，但注册要外币卡、国内访问慢 |
| Azure for Students | 12 个月 + 100 美元 | 需学校邮箱 |

> 拿到 IP 后，第 2 步的"部署"方法都通用（只要 Linux + Node ≥ 20 或 Docker）。

---

## 第 1 步 · 云端开端口（必做，否则打不开）
阿里云控制台 → 你的**实例** → **安全组** → 入方向规则 → 放行：
- **TCP 3001**（平台 Web/API/实时对战）
- **TCP 22**（SSH 管理，通常默认已开）

---

## 第 2 步 · 部署（两条路任选）

### 🐳 路线 A：Docker（推荐，最简单）
在云服务器上执行：
```bash
# 1) 装 Docker（Ubuntu 一条命令）
curl -fsSL https://get.docker.com | sudo sh

# 2) 把项目上传到服务器（在你本地电脑执行，把 <IP> 换成服务器 IP）
#    需要先 cd 到项目根目录 D:\mbti-debate-platform
#    Windows 无 rsync 就用 scp 依次传 server/ 与 client/dist/ 到 ~/mbti/ 下
scp -r server client root@<IP>:~/mbti/

# 3) 回到服务器，构建并启动
cd ~/mbti
docker build -t mbti-debate -f cloud/mbti-cloud-deploy/Dockerfile .
docker run -d --name mbti-debate --restart always \
  -p 3001:3001 -v mbti_data:/app/data \
  -e ZHIHU_ACCESS_SECRET='你的知乎密钥' \
  mbti-debate
```
> 本目录里的 `docker-compose.yml` 是同样配置的模板，也可 `docker compose up -d`。

### 🛠️ 路线 B：无 Docker（systemd 守护）
把本目录的 **server/** 和 **build/**（即前端静态包，从 `client/dist` 复制）上传到服务器后：
```bash
sudo chmod +x deploy-nodocker.sh && sudo ./deploy-nodocker.sh
```
脚本会自动装 Node22、装依赖、写 systemd 服务（开机自启 + 崩溃自动拉起）。

---

## 第 3 步 · 使用
浏览器/手机打开：
```
http://<服务器公网IP>:3001
```
- 前端自动同源连后端，**无需任何额外配置**（含语音、实时对战 WebSocket）
- 注册个账号就能玩；数据存 `/app/data`（docker volume）或 `/opt/mbti-data`（systemd 模式）

### 桌面客户端连云端
本机 Electron 版 → **设置页** → 服务器地址填 `http://<服务器公网IP>:3001` → 保存刷新，桌面版即连云端同一份数据。

---

## 📝 注意
- **知乎密钥**（ZHIHU_ACCESS_SECRET）：在 developer.zhihu.com 申请；不填则 AI 辩论/热榜/搜索/导入等知乎功能不可用，其余正常。
- 学生机免费到期前会停 → 建议数据做备份（`/app/data/debate.db` 拷走即可）。
- 1G 内存也够跑，别升级配置避免扣费；到期前记得手动释放实例防扣费。

## 目录说明
```
mbti-cloud-deploy/
├── Dockerfile            # 单镜像（server+前端+sqlite），构建上下文=项目根
├── docker-compose.yml    # docker 运行模板（填知乎密钥）
├── deploy-nodocker.sh    # 无 Docker 方案：装依赖+systemd 守护
└── README.md             # 本文件
```
