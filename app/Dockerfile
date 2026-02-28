FROM node:20-alpine AS base

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

# Install pnpm (pinned to match lockfile version)
RUN npm install -g pnpm@10.8.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build-time env vars passed via --build-arg (NEXT_PUBLIC_ are inlined by Next.js at build time)
# These must NOT be hardcoded — they come from Cloud Build substitutions or Secret Manager.
ARG DATABASE_URL="postgresql://localhost/foodyepay"
ARG NEXT_PUBLIC_ONCHAINKIT_API_KEY
ARG NEXT_PUBLIC_COINBASE_PROJECT_ID
ARG NEXT_PUBLIC_COINBASE_ENV="production"
ARG NEXT_PUBLIC_BASE_RPC_URL="https://mainnet.base.org"
ARG NEXT_PUBLIC_RESEND_API_KEY
ARG NEXT_PUBLIC_RESEND_SENDER_EMAIL="noreply@foodyepay.com"
ARG NEXT_PUBLIC_AGENT_URL="https://foodyepay-agent-443906211776.us-east1.run.app"

ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_ONCHAINKIT_API_KEY=$NEXT_PUBLIC_ONCHAINKIT_API_KEY
ENV NEXT_PUBLIC_COINBASE_PROJECT_ID=$NEXT_PUBLIC_COINBASE_PROJECT_ID
ENV NEXT_PUBLIC_COINBASE_ENV=$NEXT_PUBLIC_COINBASE_ENV
ENV NEXT_PUBLIC_BASE_RPC_URL=$NEXT_PUBLIC_BASE_RPC_URL
ENV NEXT_PUBLIC_RESEND_API_KEY=$NEXT_PUBLIC_RESEND_API_KEY
ENV NEXT_PUBLIC_RESEND_SENDER_EMAIL=$NEXT_PUBLIC_RESEND_SENDER_EMAIL
ENV NEXT_PUBLIC_AGENT_URL=$NEXT_PUBLIC_AGENT_URL

RUN pnpm build

# --- Runner stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
