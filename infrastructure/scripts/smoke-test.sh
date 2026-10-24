#!/usr/bin/env bash
# End-to-end check: register -> upload -> transcode -> adaptive playback.
#
# Exercises the whole pipeline against the running local stack, including the
# parts unit tests cannot reach: multipart upload, the BullMQ handoff, ffmpeg,
# object storage, the bucket's public-read policy and private playback tokens.
#
# Prerequisites:
#   cd infrastructure/terraform/environments/local && terraform apply
#   npm run -w backend dev
#   npm run worker:build && npm run worker:up
set -uo pipefail

API="${API_URL:-http://localhost:3001}/api/v1"
EMAIL="${SMOKE_EMAIL:-creator@example.com}"
PASSWORD="${SMOKE_PASSWORD:-CreatorPass123!}"
WORK="$(mktemp -d)"
SAMPLE="$WORK/sample.mp4"
FAILURES=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

check() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$label"; else fail "$label (got '$actual', want '$expected')"; fi
}

json() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "1. preflight"
check "api is healthy" "$(status_of "${API%/api/v1}/health")" "200"
if [[ $FAILURES -gt 0 ]]; then
  echo "API is not reachable; start it with: npm run -w backend dev" >&2
  exit 1
fi

echo "2. generating a test clip with the worker image's ffmpeg"
docker run --rm --entrypoint ffmpeg -v "$WORK:/out" video-streaming-worker:local \
  -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=12" \
  -f lavfi -i "sine=frequency=440:duration=12" \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest /out/sample.mp4 \
  >/dev/null 2>&1
if [[ -s "$SAMPLE" ]]; then pass "sample clip generated"; else fail "could not generate sample clip"; exit 1; fi

echo "3. authentication"
TOKEN="$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json 'd["data"]["accessToken"]' 2>/dev/null)"
if [[ -n "${TOKEN:-}" ]]; then pass "logged in as $EMAIL"; else fail "login failed (run: npm run -w backend db:seed)"; exit 1; fi

check "bad password is rejected" \
  "$(status_of -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")" "401"
check "unauthenticated listing is rejected" "$(status_of "$API/videos")" "401"

echo "4. rejecting a non-video upload"
printf '#!/bin/sh\necho not a video\n' > "$WORK/fake.mp4"
check "renamed script is refused" \
  "$(status_of -X POST "$API/videos" -H "Authorization: Bearer $TOKEN" \
     -F 'title=Fake' -F "file=@$WORK/fake.mp4;type=video/mp4")" "415"

# upload <title> <isPublic> -> prints the new video id
upload() {
  curl -s -X POST "$API/videos" -H "Authorization: Bearer $TOKEN" \
    -F "title=$1" -F "isPublic=$2" -F "file=@$SAMPLE;type=video/mp4" \
    | json 'd["data"]["id"]'
}

# await_ready <id> -> prints the final status
await_ready() {
  local id="$1" st=""
  for _ in $(seq 1 60); do
    st="$(curl -s "$API/videos/$id/status" -H "Authorization: Bearer $TOKEN" | json 'd["data"]["status"]' 2>/dev/null)"
    [[ "$st" == "COMPLETED" || "$st" == "FAILED" ]] && break
    sleep 3
  done
  echo "$st"
}

echo "5. public video: upload, transcode, adaptive playback"
PUBLIC_ID="$(upload 'Smoke public' true)"
if [[ -n "${PUBLIC_ID:-}" ]]; then pass "upload accepted ($PUBLIC_ID)"; else fail "upload failed"; exit 1; fi
check "transcode completed" "$(await_ready "$PUBLIC_ID")" "COMPLETED"

RECORD="$(curl -s "$API/videos/$PUBLIC_ID" -H "Authorization: Bearer $TOKEN")"
PLAYBACK="$(echo "$RECORD" | json 'd["data"]["playbackUrl"]')"
RENDITIONS="$(echo "$RECORD" | json 'len(d["data"]["resolutions"])')"
POSTER="$(echo "$RECORD" | json 'd["data"]["posterUrl"]')"

check "ladder capped at the 720p source" "$RENDITIONS" "5"
check "master playlist is public" "$(status_of "$PLAYBACK")" "200"

EMBED="$(echo "$RECORD" | json 'd["data"]["embedUrl"] or ""')"
if [[ -n "$EMBED" ]]; then pass "public video advertises an embed URL"; else fail "public video has no embed URL"; fi
check "poster image is public" "$(status_of "$POSTER")" "200"

MASTER="$(curl -s "$PLAYBACK")"
for r in 144p 240p 360p 480p 720p; do
  if grep -q "$r/master.m3u8" <<< "$MASTER"; then pass "master lists $r"; else fail "master is missing $r"; fi
done
if grep -q 'CODECS="avc1\.' <<< "$MASTER"; then pass "variants advertise codecs"; else fail "variants advertise no codecs"; fi

BASE="$(dirname "$PLAYBACK")"
check "variant playlist is served" "$(status_of "$BASE/720p/master.m3u8")" "200"
check "segment is served" "$(status_of "$BASE/720p/segment_0.ts")" "200"

SMALL="$(curl -s -o /dev/null -w '%{size_download}' "$BASE/144p/segment_0.ts")"
LARGE="$(curl -s -o /dev/null -w '%{size_download}' "$BASE/720p/segment_0.ts")"
if (( SMALL < LARGE )); then pass "144p segment is smaller than 720p ($SMALL < $LARGE)"; else fail "ladder bitrates look wrong ($SMALL vs $LARGE)"; fi

echo "6. private video: tokenised playback"
PRIVATE_ID="$(upload 'Smoke private' false)"
check "transcode completed" "$(await_ready "$PRIVATE_ID")" "COMPLETED"

PRIVATE_PB="$(curl -s "$API/videos/$PRIVATE_ID" -H "Authorization: Bearer $TOKEN" | json 'd["data"]["playbackUrl"]')"
PRIVATE_BASE="$(dirname "$PRIVATE_PB")"

check "owner can read the record" "$(status_of "$API/videos/$PRIVATE_ID" -H "Authorization: Bearer $TOKEN")" "200"

# Regression: the playback URL embeds a token, and the player page re-fetches
# the record while a video encodes. If each fetch returned a different URL the
# player would treat it as a new stream and restart from the beginning every
# few seconds -- so two fetches a moment apart must agree.
URL_A="$(curl -s "$API/videos/$PRIVATE_ID" -H "Authorization: Bearer $TOKEN" | json 'd["data"]["playbackUrl"]')"
sleep 2
URL_B="$(curl -s "$API/videos/$PRIVATE_ID" -H "Authorization: Bearer $TOKEN" | json 'd["data"]["playbackUrl"]')"
check "playback URL is stable across fetches" "$([[ "$URL_A" == "$URL_B" ]] && echo same || echo different)" "same"
check "anonymous cannot read the record" "$(status_of "$API/videos/$PRIVATE_ID")" "401"
check "playlist loads with the token alone" "$(status_of "$PRIVATE_PB")" "200"
check "nested segment loads with the same token" "$(status_of "$PRIVATE_BASE/720p/segment_0.ts")" "200"
check "forged token is refused" \
  "$(status_of "$API/videos/$PRIVATE_ID/hls/$(printf 'x%.0s' {1..80}).$(printf 'y%.0s' {1..43})/master.m3u8")" "403"

echo "7. deletion releases storage"
check "delete returns 204" "$(status_of -X DELETE "$API/videos/$PUBLIC_ID" -H "Authorization: Bearer $TOKEN")" "204"
check "deleted video is gone" "$(status_of "$API/videos/$PUBLIC_ID" -H "Authorization: Bearer $TOKEN")" "404"
check "its media is gone too" "$(status_of "$PLAYBACK")" "404"

curl -s -X DELETE "$API/videos/$PRIVATE_ID" -H "Authorization: Bearer $TOKEN" >/dev/null

echo
if (( FAILURES == 0 )); then
  printf '\033[32mall checks passed\033[0m\n'
  exit 0
fi
printf '\033[31m%d check(s) failed\033[0m\n' "$FAILURES"
exit 1
