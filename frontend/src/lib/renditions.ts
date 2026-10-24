/**
 * Ladder order for display.
 *
 * Mirrors RENDITION_LADDER in packages/shared; kept as a plain list here so
 * the browser bundle does not pull in the worker's encode settings.
 */
export const RENDITION_ORDER = ['144p', '240p', '360p', '480p', '720p', '1080p', '4k'] as const;
