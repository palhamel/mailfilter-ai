FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:24-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data/logs && chown -R appuser:appgroup /app/data

USER appuser

HEALTHCHECK --interval=15m --timeout=5s --start-period=30s --retries=3 \
  CMD node dist/health/check.js || exit 1

CMD ["node", "dist/index.js"]
