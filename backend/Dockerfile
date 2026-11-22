# MEDICORE PRODUCTION DOCKERFILE
# NestJS 12 + Prisma 7 + PostgreSQL

# BUILD STAGE
FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

# Generate Prisma Client using a temporary build-only URL
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npx prisma generate

# Compile NestJS
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# PRODUCTION STAGE
FROM node:24-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
