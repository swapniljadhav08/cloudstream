# API service (docs/16_Deployment.md).
#
# Compiled to JavaScript and run on a runtime image that carries no toolchain.
# Build context is the repository root: the API compiles against the shared
# workspace package, which must be built first.
FROM node:22-alpine AS build

WORKDIR /app

# Manifests first so a source edit does not reinstall.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY worker/package.json ./worker/
COPY frontend/package.json ./frontend/

RUN npm install --no-audit --no-fund --ignore-scripts

COPY packages ./packages
COPY backend ./backend

RUN npx prisma generate --schema backend/prisma/schema.prisma \
 && npm run -w @video-streaming/shared build \
 && npm run -w backend build

# --- runtime ----------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# node_modules carries the workspace symlink to packages/shared, so the built
# package has to come across at the same path for that link to resolve.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

WORKDIR /app/backend

EXPOSE 3001

CMD ["node", "dist/main.js"]
