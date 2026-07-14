# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@11.9.0 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL"
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# API Route가 런타임에 Markdown 글 존재 여부를 확인할 수 있도록 원본 글을 포함한다.
COPY --from=builder /app/content ./content
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
