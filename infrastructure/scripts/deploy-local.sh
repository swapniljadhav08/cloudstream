#!/usr/bin/env bash
# Deploys the whole application onto the Terraform-provisioned local stack.
#
# Terraform owns the infrastructure tier (PostgreSQL, Redis, S3-compatible
# storage and the bucket layout). This script owns the application tier: it
# builds production images for the API, worker and web app, applies pending
# migrations, and runs all three on the stack's network.
#
#   ./deploy-local.sh          build and deploy
#   ./deploy-local.sh --down   stop and remove the application containers
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.docker"

API_NAME=video-streaming-local-api
WEB_NAME=video-streaming-local-web
WORKER_NAME=video-streaming-local-worker

API_IMAGE=video-streaming-api:local
WEB_IMAGE=video-streaming-web:local
WORKER_IMAGE=video-streaming-worker:local

# Ports the browser talks to. The API and media endpoints are baked into the
# web bundle at build time, so they must be reachable from the host.
API_PORT=3001
WEB_PORT=3000

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
die() { printf '  \033[31mFAIL\033[0m %s\n' "$1" >&2; exit 1; }

if [[ "${1:-}" == "--down" ]]; then
  step "Stopping the application tier"
  for name in "$WEB_NAME" "$API_NAME" "$WORKER_NAME"; do
    docker rm -f "$name" >/dev/null 2>&1 && ok "removed $name" || true
  done
  echo
  echo "Infrastructure is still up. To remove it too:"
  echo "  cd infrastructure/terraform/environments/local && terraform destroy"
  exit 0
fi

step "Checking the infrastructure tier"
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE — run: cd infrastructure/terraform/environments/local && terraform apply"

NETWORK="$(grep '^PLATFORM_NETWORK=' "$ENV_FILE" | cut -d= -f2)"
[[ -n "$NETWORK" ]] || die "PLATFORM_NETWORK is not set in $ENV_FILE"
docker network inspect "$NETWORK" >/dev/null 2>&1 || die "Network $NETWORK is missing — re-run terraform apply"

for container in video-streaming-local-postgres video-streaming-local-redis video-streaming-local-localstack; do
  docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -q true \
    || die "$container is not running — re-run terraform apply"
done
ok "postgres, redis and object storage are up on $NETWORK"

# The browser-facing media URL comes from the Terraform outputs, so the web
# bundle and the API agree on where media is served from.
MEDIA_BASE_URL="$(grep '^NEXT_PUBLIC_MEDIA_BASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
[[ -n "$MEDIA_BASE_URL" ]] || die "NEXT_PUBLIC_MEDIA_BASE_URL is not set in $ENV_FILE"
ok "media served from $MEDIA_BASE_URL"

step "Building images"
docker build -q -f "$REPO_ROOT/infrastructure/docker/backend.Dockerfile" -t "$API_IMAGE" "$REPO_ROOT" >/dev/null
ok "api"
docker build -q -f "$REPO_ROOT/infrastructure/docker/worker.Dockerfile" -t "$WORKER_IMAGE" "$REPO_ROOT" >/dev/null
ok "worker"
docker build -q \
  --build-arg "NEXT_PUBLIC_API_URL=http://localhost:${API_PORT}" \
  --build-arg "NEXT_PUBLIC_MEDIA_BASE_URL=${MEDIA_BASE_URL}" \
  -f "$REPO_ROOT/infrastructure/docker/frontend.Dockerfile" -t "$WEB_IMAGE" "$REPO_ROOT" >/dev/null
ok "web"

step "Applying database migrations"
docker run --rm --network "$NETWORK" --env-file "$ENV_FILE" \
  -w /app/backend "$API_IMAGE" \
  node ../node_modules/prisma/build/index.js migrate deploy 2>&1 | tail -3
ok "schema up to date"

step "Starting the application tier"
for name in "$WEB_NAME" "$API_NAME" "$WORKER_NAME"; do
  docker rm -f "$name" >/dev/null 2>&1 || true
done

# The API binds a host port because the browser calls it directly.
docker run -d --name "$API_NAME" --network "$NETWORK" --env-file "$ENV_FILE" \
  -p "${API_PORT}:3001" --restart unless-stopped "$API_IMAGE" >/dev/null
ok "api on :$API_PORT"

docker run -d --name "$WORKER_NAME" --network "$NETWORK" --env-file "$ENV_FILE" \
  --restart unless-stopped "$WORKER_IMAGE" >/dev/null
ok "worker"

docker run -d --name "$WEB_NAME" --network "$NETWORK" \
  -p "${WEB_PORT}:3000" --restart unless-stopped "$WEB_IMAGE" >/dev/null
ok "web on :$WEB_PORT"

step "Waiting for health"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    ok "api healthy after ${i}s"
    break
  fi
  [[ $i -eq 60 ]] && die "api did not become healthy — docker logs $API_NAME"
  sleep 1
done

for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:${WEB_PORT}/auth/login"; then
    ok "web serving after ${i}s"
    break
  fi
  [[ $i -eq 60 ]] && die "web did not start — docker logs $WEB_NAME"
  sleep 1
done

echo
printf '\033[32mDeployed.\033[0m\n'
echo "  Web      http://localhost:${WEB_PORT}"
echo "  API      http://localhost:${API_PORT}/api/v1"
echo "  Health   http://localhost:${API_PORT}/health"
echo "  Metrics  http://localhost:${API_PORT}/metrics"
echo
echo "  Logs     docker logs -f $API_NAME | $WORKER_NAME | $WEB_NAME"
echo "  Stop     npm run deploy:down"
