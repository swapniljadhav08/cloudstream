/** Parses a duration like `15m`, `7d`, `900s` into milliseconds. */
export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${duration}" (expected e.g. 15m, 7d)`);
  }
  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return value * factor;
}

/**
 * Duration in whole seconds.
 *
 * @nestjs/jwt types `expiresIn` against the `ms` library's string union, which
 * a plain `string` from configuration does not satisfy. A number of seconds is
 * accepted by the same option and needs no cast.
 */
export function durationToSeconds(duration: string): number {
  return Math.floor(durationToMs(duration) / 1000);
}
