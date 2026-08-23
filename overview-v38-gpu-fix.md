# DebateSphere v38 GPU 修复版

## 交付物
- DebateSphere-v38/ 目录版（含GPU修复，双击启动.bat运行）
- DebateSphere-v38-debug.apk / release.apk（Android，无GPU问题）

注意：旧的单文件exe有GPU bug，请使用目录版。

## GPU修复
main.js: disable-gpu + no-sandbox + disableHardwareAcceleration

## 使用
1. cd server && npm start
2. DebateSphere-v38/ 目录双击 启动.bat
3. Android: 安装APK，设置页改 http://<电脑IP>:3001
