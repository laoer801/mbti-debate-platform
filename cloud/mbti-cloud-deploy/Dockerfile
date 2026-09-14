# ============================================================
# MBTI 辩论平台 · 云端单镜像（server + 前端静态 + sqlite）
# 构建上下文 = 项目根目录（需包含 server/ 与 client/dist/）
#   例：docker build -t mbti-debate -f cloud/mbti-cloud-deploy/Dockerfile .
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
# 依赖
COPY --from=deps /app/node_modules ./node_modules
# 后端（server 内 __dirname/../build 回退 → 前端放 /app/build 即同源托管）
COPY server/ ./server
RUN mkdir -p /app/data
# 前端静态产物（手机/浏览器访问 http://IP:3001 自动同源，无需改配置）
COPY client/dist ./build

ENV NODE_ENV=production
ENV PORT=3001
ENV MBTI_DATA_DIR=/app/data
EXPOSE 3001

CMD ["node", "server/index.js"]
