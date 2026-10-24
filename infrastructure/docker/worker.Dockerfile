# Transcoding worker (docs/15_Transcoding_Pipeline.md).
#
# Containerised because it is the only component with a native dependency:
# ffmpeg. Build context is the repository root, since the worker compiles
# against the shared workspace package.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY worker/package.json ./worker/
COPY frontend/package.json ./frontend/

RUN npm install --no-audit --no-fund --ignore-scripts

COPY packages ./packages
COPY worker ./worker
COPY backend/prisma ./backend/prisma

RUN npx prisma generate --schema backend/prisma/schema.prisma \
 && npm run -w @video-streaming/shared build \
 && npm run -w worker build

# --- runtime ----------------------------------------------------------------
FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

ENV NODE_ENV=production
ENV WORK_DIR=/tmp/transcode

# node_modules holds the workspace symlink to packages/shared, so the built
# package must land at the same path for that link to resolve.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/worker/package.json ./worker/package.json
COPY --from=build /app/worker/dist ./worker/dist

WORKDIR /app/worker

CMD ["node", "dist/index.js"]
