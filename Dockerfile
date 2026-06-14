# Standalone HTTP server for local / container use (POST /text-to-sql).
# Library build: npm run build; standalone entry: dist/standalone/main.js

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# npm install (not ci): lockfile may omit Linux-only optional deps when generated on Windows.
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json tsconfig.standalone.json ./
COPY index.ts db-intelligence.module.ts db-intelligence.config.ts mysql.config.ts mysql-pool.provider.ts openai.config.ts env-parsers.ts ./
COPY features ./features
COPY services ./services
COPY standalone ./standalone

RUN npm run build && npm run build:standalone

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/standalone/main.js"]
