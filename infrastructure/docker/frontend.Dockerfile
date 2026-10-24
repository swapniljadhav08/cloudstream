# Web application (docs/16_Deployment.md).
#
# NEXT_PUBLIC_* values are inlined at build time, not read at runtime, so the
# browser-facing API and media URLs are build arguments. Rebuild the image to
# point it at a different environment.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY worker/package.json ./worker/
COPY frontend/package.json ./frontend/

RUN npm install --no-audit --no-fund --ignore-scripts

COPY packages ./packages
COPY frontend ./frontend

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MEDIA_BASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL

RUN npm run -w frontend build

# --- runtime ----------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next's standalone output bundles its own minimal node_modules.
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

EXPOSE 3000

CMD ["node", "frontend/server.js"]
