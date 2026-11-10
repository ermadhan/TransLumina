/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats,
 * including Shorts, watch, embed, youtu.be, mobile URLs, and query variations.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      // 1. YouTube Shorts: /shorts/<id>
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }

      // 2. Standard Watch URL: /watch?v=<id>
      if (parsed.pathname === '/watch' || parsed.pathname === '/watch_videos') {
        const v = parsed.searchParams.get('v');
        if (v && v.length >= 11) return v.substring(0, 11);
      }

      // 3. Embed URL: /embed/<id>
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }

      // 4. Legacy /v/<id>
      if (parsed.pathname.startsWith('/v/')) {
        const id = parsed.pathname.split('/v/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }
    } else if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      // 5. Shortened youtu.be/<id>
      const id = parsed.pathname.slice(1).split('/')[0]?.split('?')[0];
      if (id && id.length >= 11) return id.substring(0, 11);
    }
  } catch {
    // If not a parseable URL, fall through to regex matching
  }

  // Fallback regex matching standard 11-char base64-like alphanumeric YouTube IDs
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  if (match && match[1]) {
    return match[1];
  }

  // If the user entered just the 11-char ID directly (e.g. "a-Mui2QYF-0" or "dQw4w9WgXcQ")
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Checks if a given URL or string corresponds to a YouTube video or Short
 */
export function isYouTubeUrl(url?: string): boolean {
  if (!url) return false;
  return extractYouTubeId(url) !== null;
}

/**
 * Generates an iframe-safe YouTube embed URL with JS API enabled
 */
export function getYouTubeEmbedUrl(urlOrId: string, options: { autoplay?: boolean; origin?: string } = {}): string {
  const id = extractYouTubeId(urlOrId) || urlOrId;
  const autoplay = options.autoplay ? 1 : 0;
  const originParam = typeof window !== 'undefined' && window.location.origin
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : '';

  return `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=${autoplay}&playsinline=1&rel=0&modestbranding=1${originParam}`;
}

/**
 * Returns the highest resolution available thumbnail URL for a YouTube video
 */
export function getYouTubeThumbnailUrl(urlOrId: string): string {
  const id = extractYouTubeId(urlOrId) || urlOrId;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
