#!/usr/bin/env bash
# Starts the transcoding worker against the Terraform-provisioned stack.
#
# The worker joins the stack's docker network so it reaches postgres, redis and
# localstack by their container aliases, which is what .env.docker encodes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.docker"
IMAGE="video-streaming-worker:local"
NAME="video-streaming-local-worker"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Run: cd infrastructure/terraform/environments/local && terraform apply" >&2
  exit 1
fi

NETWORK="$(grep '^PLATFORM_NETWORK=' "$ENV_FILE" | cut -d= -f2)"
if [[ -z "$NETWORK" ]]; then
  echo "PLATFORM_NETWORK is not set in $ENV_FILE" >&2
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$NAME" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  "$IMAGE" >/dev/null

echo "worker started on network $NETWORK"
echo "logs: docker logs -f $NAME"
