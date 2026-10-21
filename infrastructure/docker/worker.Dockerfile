# Transcoding worker (docs/15_Transcoding_Pipeline.md).
#
# Containerised because it is the only component with a native dependency:
# ffmpeg. Build context is the repository root, so the workspace packages it
# imports are available.
#
# ponytail: single stage running TypeScript through ts-node, which keeps the
# dev deps in the image. Fine for a local worker; add a build stage that emits
# JS and prunes to production deps before shipping this anywhere real.
FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# Manifests first: layer caching means a source edit does not reinstall.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY worker/package.json ./worker/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# --ignore-scripts: the postinstall hooks belong to packages this image does
# not run, and prisma generate is invoked explicitly below.
RUN npm install --no-audit --no-fund --ignore-scripts

COPY packages ./packages
COPY worker ./worker
COPY backend/prisma ./backend/prisma

RUN npx prisma generate --schema backend/prisma/schema.prisma

ENV NODE_ENV=production
ENV WORK_DIR=/tmp/transcode

# Run from the workspace directory so ts-node picks up worker/tsconfig.json.
# From /app it finds no project file and falls back to defaults that conflict
# with the module settings. Node still resolves /app/node_modules by walking up.
WORKDIR /app/worker

CMD ["node", "-r", "ts-node/register/transpile-only", "src/index.ts"]
