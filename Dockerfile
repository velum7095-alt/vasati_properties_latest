# ------------------------------------------------------------------------------
# MULTI-STAGE DOCKERFILE FOR BANGALORE REAL ESTATE DPDP PORTAL
# Optimized for Coolify and Docker Compose deployments
# ------------------------------------------------------------------------------

# 1. Dependencies Stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder Stage
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client & Build Standalone Bundle
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV STANDALONE=1
RUN npm run build

# 3. Production Runner Stage
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for principle of least privilege
RUN addgroup --system --gid 1001 nodejs &&     adduser --system --uid 1001 nextjs

# Copy application runtime, static assets, and Prisma schema. The production
# server is the Express API in server.js, backed by PostgreSQL.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy Container Entrypoint Script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3   CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
