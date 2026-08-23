# ====== Backend Dockerfile ======
FROM node:22-alpine AS builder
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

# Runtime stage
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server/ ./
COPY server/seeds/profiles.json ./seeds/profiles.json
RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "index.js"]
