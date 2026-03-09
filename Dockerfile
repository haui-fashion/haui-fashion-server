# ----------- Stage 1: Dependencies -----------
FROM node:20-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile


# ----------- Stage 2: Builder -----------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma generate
RUN pnpm build


# ----------- Stage 3: Production -----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# only copy needed files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
