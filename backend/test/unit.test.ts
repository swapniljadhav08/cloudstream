import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ladderForSource,
  boxFor,
  isPortrait,
  isUpscale,
  storageKeys,
  hlsSubPath,
  RENDITION_LADDER,
} from '@video-streaming/shared';
import { durationToMs, durationToSeconds } from '../src/shared/kernel/duration';
import { issueStreamToken, verifyStreamToken, mediaContentType } from '../src/shared/kernel/stream-token';
import { looksLikeVideo } from '../src/modules/video/domain/upload-policy';
import { avcCodecString, buildMasterPlaylist } from '../../worker/src/playlist';

const SECRET = 'a'.repeat(64);

/** Looks a rung up by name, so adding a rung cannot silently shift a test. */
const rung = (name: string) => RENDITION_LADDER.find((r) => r.name === name)!;

test('ladder is capped by the short side, for landscape and portrait alike', () => {
  assert.deepEqual(
    ladderForSource(1280, 720).map((r) => r.name),
    ['144p', '240p', '360p', '480p', '720p'],
  );

  // A 720x1280 vertical clip is a 720p source, not a 1280p one: capping on
  // height alone would wrongly offer a 1080p rendition.
  assert.deepEqual(
    ladderForSource(720, 1280).map((r) => r.name),
    ['144p', '240p', '360p', '480p', '720p'],
  );

  assert.deepEqual(
    ladderForSource(3840, 2160).map((r) => r.name),
    RENDITION_LADDER.map((r) => r.name),
  );

  // A source below the lowest rung still yields one playable rendition.
  assert.deepEqual(ladderForSource(160, 90).map((r) => r.name), ['144p']);
});

test('upscaling is opt-in, and upscaled rungs are identifiable', () => {
  // A 720x398 source normally stops at 360p.
  assert.deepEqual(
    ladderForSource(720, 398).map((r) => r.name),
    ['144p', '240p', '360p'],
  );

  // Opting in offers the full ladder, upscales included.
  assert.deepEqual(
    ladderForSource(720, 398, { allowUpscale: true }).map((r) => r.name),
    RENDITION_LADDER.map((r) => r.name),
  );

  // And each rung can be told apart from a genuine one.
  assert.ok(!isUpscale(rung('360p'), 720, 398));
  assert.ok(isUpscale(rung('720p'), 720, 398));
  assert.ok(isUpscale(rung('1080p'), 720, 398));
  // Portrait sources are judged on the short side too.
  assert.ok(!isUpscale(rung('720p'), 720, 1280));
});

test('encode box is transposed for portrait so the rung lands on the short side', () => {
  const r720 = rung('720p');

  assert.ok(!isPortrait(1280, 720));
  assert.ok(isPortrait(720, 1280));

  assert.deepEqual(boxFor(r720, 1920, 1080), { width: 1280, height: 720 });
  // Portrait: the box becomes 720 wide, so a 720x1280 source encodes at full
  // size instead of being squeezed into 406x720.
  assert.deepEqual(boxFor(r720, 720, 1280), { width: 720, height: 1280 });
});

test('storage keys match the documented bucket layout', () => {
  assert.equal(storageKeys.original('v1'), 'v1/original.mp4');
  assert.equal(storageKeys.thumbnail('v1', 30), 'v1/thumbnails/30s.jpg');
  assert.equal(storageKeys.hlsVariantPlaylist('v1', '720p'), 'v1/hls/720p/master.m3u8');
  assert.equal(storageKeys.hlsSegment('v1', '720p', 3), 'v1/hls/720p/segment_3.ts');
  assert.equal(storageKeys.hlsMasterPlaylist('v1'), 'v1/hls/master.m3u8');
  assert.equal(hlsSubPath('720p/segment_0.ts'), 'hls/720p/segment_0.ts');
  assert.equal(hlsSubPath('/720p/segment_0.ts'), 'hls/720p/segment_0.ts');
});

test('durations parse, and reject anything unsupported', () => {
  assert.equal(durationToMs('15m'), 900_000);
  assert.equal(durationToMs('7d'), 604_800_000);
  assert.equal(durationToSeconds('15m'), 900);
  assert.throws(() => durationToMs('15 minutes'));
  assert.throws(() => durationToMs('1w'));
});

test('avc codec strings encode the profile and level actually used', () => {
  assert.equal(avcCodecString(rung('144p')), 'avc1.42001e'); // baseline 3.0
  assert.equal(avcCodecString(rung('240p')), 'avc1.42001e'); // baseline 3.0
  assert.equal(avcCodecString(rung('720p')), 'avc1.4d0028'); // main 4.0
  assert.equal(avcCodecString(rung('1080p')), 'avc1.64002a'); // high 4.2
});

test('master playlist lists variants by ascending bandwidth', () => {
  const variants = [
    { rendition: rung('720p'), width: 1280, height: 720 },
    { rendition: rung('240p'), width: 426, height: 240 },
  ];
  const playlist = buildMasterPlaylist(variants, true);
  const lines = playlist.trim().split('\n');

  assert.equal(lines[0], '#EXTM3U');
  // The 240p variant must appear before the 720p one regardless of input order.
  assert.ok(playlist.indexOf('240p/master.m3u8') < playlist.indexOf('720p/master.m3u8'));
  assert.ok(playlist.includes('RESOLUTION=426x240'));
  assert.ok(playlist.includes('mp4a.40.2'));

  // With no audio track the codec list must not advertise one.
  assert.ok(!buildMasterPlaylist(variants, false).includes('mp4a.40.2'));
});

test('stream tokens round-trip, and reject tampering, reuse and expiry', () => {
  const token = issueStreamToken({ videoId: 'v1', userId: 'u1' }, SECRET, 3600);

  assert.deepEqual(verifyStreamToken(token, 'v1', SECRET), { videoId: 'v1', userId: 'u1' });

  // A token for one video must not unlock another.
  assert.equal(verifyStreamToken(token, 'v2', SECRET), null);
  // Signed with a different secret.
  assert.equal(verifyStreamToken(token, 'v1', 'b'.repeat(64)), null);
  // Payload edited, signature left alone.
  const [payload, signature] = token.split('.');
  const forged = `${Buffer.from('v1.u2.99999999999').toString('base64url')}.${signature}`;
  assert.equal(verifyStreamToken(forged, 'v1', SECRET), null);
  assert.ok(payload.length > 0);
  // Already expired.
  assert.equal(
    verifyStreamToken(issueStreamToken({ videoId: 'v1', userId: 'u1' }, SECRET, -1), 'v1', SECRET),
    null,
  );
  // Structurally invalid.
  assert.equal(verifyStreamToken('not-a-token', 'v1', SECRET), null);
});

test('media content types cover what the pipeline emits', () => {
  assert.equal(mediaContentType('master.m3u8'), 'application/vnd.apple.mpegurl');
  assert.equal(mediaContentType('segment_0.ts'), 'video/mp2t');
  assert.equal(mediaContentType('mystery.bin'), 'application/octet-stream');
});

test('container sniffing accepts real signatures and rejects impostors', () => {
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(8)]);
  assert.ok(looksLikeVideo(mp4));
  assert.ok(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))); // mkv/webm
  assert.ok(looksLikeVideo(Buffer.from('RIFF....AVI ')));
  assert.ok(looksLikeVideo(Buffer.from([0x46, 0x4c, 0x56, 0x01, 0, 0, 0, 0]))); // flv

  // A renamed script or image must not pass as a video.
  assert.ok(!looksLikeVideo(Buffer.from('#!/bin/sh\necho hi')));
  assert.ok(!looksLikeVideo(Buffer.from([0x89, 0x50, 0x4e, 0x47]))); // png
  assert.ok(!looksLikeVideo(Buffer.alloc(0)));
});
