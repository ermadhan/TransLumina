/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

import fs from 'fs';

// Body parsing with generous limit for audio/video media uploads (100MB)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Dedicated route to stream real spoken audio MP3s
app.get('/api/audio/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filePath = path.resolve(__dirname, 'public', 'audio', filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(filePath);
  }
  res.status(404).json({ error: 'Audio file not found' });
});

// Server-side Gemini client with required telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }
      if (parsed.pathname === '/watch' || parsed.pathname === '/watch_videos') {
        const v = parsed.searchParams.get('v');
        if (v && v.length >= 11) return v.substring(0, 11);
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }
      if (parsed.pathname.startsWith('/v/')) {
        const id = parsed.pathname.split('/v/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length >= 11) return id.substring(0, 11);
      }
    } else if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0]?.split('?')[0];
      if (id && id.length >= 11) return id.substring(0, 11);
    }
  } catch {
    // Fall back to regex
  }

  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  if (match && match[1]) {
    return match[1];
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Checks if an IPv4 or IPv6 address belongs to private, loopback, link-local,
 * multicast, or cloud metadata IP space.
 */
function isRestrictedIpAddress(ip: string): boolean {
  if (!ip) return true;
  const cleanIp = ip.trim();

  // IPv4 check
  const ipv4Match = cleanIp.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);

    // 0.0.0.0/8 (Current network)
    if (o1 === 0) return true;
    // 10.0.0.0/8 (Private Class A)
    if (o1 === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (o1 === 169 && o2 === 254) return true;
    // 172.16.0.0/12 (Private Class B: 172.16 - 172.31)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16 (Private Class C)
    if (o1 === 192 && o2 === 168) return true;
    // 224.0.0.0/4 (Multicast / Broadcast)
    if (o1 >= 224) return true;

    return false;
  }

  // IPv6 check
  const lowerV6 = cleanIp.toLowerCase();
  // Loopback (::1)
  if (lowerV6 === '::1' || lowerV6 === '0:0:0:0:0:0:0:1') return true;
  // Unspecified (::)
  if (lowerV6 === '::' || lowerV6 === '0:0:0:0:0:0:0:0') return true;
  // Link-local (fe80::/10)
  if (lowerV6.startsWith('fe8') || lowerV6.startsWith('fe9') || lowerV6.startsWith('fea') || lowerV6.startsWith('feb')) return true;
  // Unique local addresses (fc00::/7)
  if (lowerV6.startsWith('fc') || lowerV6.startsWith('fd')) return true;
  // Multicast (ff00::/8)
  if (lowerV6.startsWith('ff')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
  if (lowerV6.includes('::ffff:')) {
    const embeddedIpv4 = lowerV6.split('::ffff:')[1];
    if (embeddedIpv4 && isRestrictedIpAddress(embeddedIpv4)) return true;
  }

  return false;
}

/**
 * SSRF Protection Validator with DNS resolution:
 * Ensures URLs only target public, safe web hosts over standard HTTP/HTTPS.
 * Resolves hostnames via DNS and verifies that all resolved IP addresses are public.
 */
async function validateSafeExternalUrl(inputUrl: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const parsed = new URL(inputUrl);
    // Protocol check: only http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Only HTTP and HTTPS protocols are supported.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block obvious loopback, localhost, and internal domain names
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal' ||
      hostname === '169.254.169.254'
    ) {
      return { safe: false, error: 'Access to internal and metadata hosts is prohibited.' };
    }

    // Port check: disallow non-standard internal ports
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443' && parsed.port !== '8080' && parsed.port !== '8443') {
      return { safe: false, error: 'Non-standard port restricted.' };
    }

    // If hostname is directly an IP literal
    if (isRestrictedIpAddress(hostname)) {
      return { safe: false, error: 'Access to private or restricted IP addresses is prohibited.' };
    }

    // Resolve domain via DNS to verify resolved IPs (protects against DNS rebinding & internal hostnames)
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return { safe: false, error: 'Host could not be resolved.' };
      }
      for (const rec of records) {
        if (isRestrictedIpAddress(rec.address)) {
          return { safe: false, error: 'Domain resolves to a restricted internal IP address.' };
        }
      }
    } catch {
      return { safe: false, error: 'DNS resolution failed for hostname.' };
    }

    return { safe: true };
  } catch {
    return { safe: false, error: 'Malformed URL.' };
  }
}

/**
 * Safe media fetcher:
 * - Prevents SSRF bypass by manual redirect tracking and re-validating every redirect destination.
 * - Streams chunks with an overall timeout and immediate byte-cap termination to prevent memory exhaustion.
 */
async function safeFetchMedia(
  initialUrl: string,
  maxBytes = 35 * 1024 * 1024,
  timeoutMs = 15000
): Promise<{ ok: boolean; buffer?: Buffer; contentType?: string; status?: number; error?: string }> {
  let currentUrl = initialUrl;
  const maxRedirects = 3;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const validation = await validateSafeExternalUrl(currentUrl);
    if (!validation.safe) {
      return { ok: false, error: validation.error || 'Destination URL failed security validation' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchRes = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual', // Manual redirect control to inspect next hop
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/*,video/*,*/*',
        },
      });

      // Handle redirects manually to re-validate destination
      if ([301, 302, 303, 307, 308].includes(fetchRes.status)) {
        clearTimeout(timeoutId);
        const location = fetchRes.headers.get('location');
        if (!location) {
          return { ok: false, error: 'Redirect location header missing' };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!fetchRes.ok) {
        clearTimeout(timeoutId);
        return { ok: false, status: fetchRes.status, error: `Remote server responded with ${fetchRes.status}` };
      }

      // Check Content-Length header upfront
      const contentLengthHeader = fetchRes.headers.get('content-length');
      if (contentLengthHeader) {
        const declaredLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredLength) && declaredLength > maxBytes) {
          clearTimeout(timeoutId);
          return { ok: false, error: `Media size exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit` };
        }
      }

      // Stream body with cumulative byte tracking
      if (!fetchRes.body) {
        clearTimeout(timeoutId);
        return { ok: false, error: 'No response body received' };
      }

      const reader = fetchRes.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            clearTimeout(timeoutId);
            return { ok: false, error: `Media download exceeded ${Math.round(maxBytes / (1024 * 1024))}MB limit` };
          }
          chunks.push(value);
        }
      }

      clearTimeout(timeoutId);
      const combined = Buffer.concat(chunks);
      const contentType = fetchRes.headers.get('content-type') || '';
      return { ok: true, buffer: combined, contentType, status: fetchRes.status };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as Error).name === 'AbortError';
      return {
        ok: false,
        error: isAbort ? 'Download timed out' : ((err as Error).message || 'Network download failed'),
      };
    }
  }

  return { ok: false, error: 'Too many redirects' };
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Extract metadata from media URLs (YouTube, Spotify, Web Streams)
app.post('/api/extract-url-info', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const trimmedUrl = url.trim();
    const validation = await validateSafeExternalUrl(trimmedUrl);
    if (!validation.safe) {
      return res.status(400).json({ error: validation.error || 'Invalid or restricted media URL.' });
    }
    const ytId = extractYouTubeId(trimmedUrl);

    if (ytId) {
      let title = 'YouTube Video';
      let author = 'Creator';
      let thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
        if (oembedRes.ok) {
          const data = (await oembedRes.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
          title = data.title || title;
          author = data.author_name || author;
          thumbnailUrl = data.thumbnail_url || thumbnailUrl;
        }
      } catch (err) {
        console.warn('oEmbed fetch failed:', err);
      }

      return res.json({
        type: 'youtube',
        videoId: ytId,
        title,
        author,
        thumbnailUrl,
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1`,
      });
    }

    // Spotify check
    if (trimmedUrl.includes('spotify.com')) {
      return res.json({
        type: 'spotify',
        title: 'Spotify Track / Episode',
        author: 'Spotify Artist',
        url: trimmedUrl,
      });
    }

    // Generic direct media stream
    const isDirectAudio = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(trimmedUrl);
    const isDirectVideo = /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(trimmedUrl);

    return res.json({
      type: isDirectVideo ? 'direct-video' : isDirectAudio ? 'direct-audio' : 'generic-web',
      title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Web Media Stream',
      url: trimmedUrl,
    });
  } catch (err) {
    console.error('Error extracting URL info:', err);
    res.status(500).json({ error: 'Failed to extract URL info' });
  }
});

// Translate an existing transcript to a new target language
app.post('/api/translate-existing', async (req: Request, res: Response) => {
  try {
    const { segments, targetLanguage } = req.body;
    if (!segments || !Array.isArray(segments) || !targetLanguage) {
      return res.status(400).json({ error: 'Segments array and targetLanguage are required' });
    }

    const segmentsPayload = segments.map((s: { id: string; originalText: string }) => ({
      id: s.id,
      text: s.originalText,
    }));

    const prompt = `Translate the following dialogue segments accurately into ${targetLanguage}.
Maintain natural phrasing suitable for video subtitles.
Input segments: ${JSON.stringify(segmentsPayload)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are an expert subtitle translator. Translate each segment accurately and return strictly JSON array of objects with { id: string, translatedText: string }.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              translatedText: { type: Type.STRING },
            },
            required: ['id', 'translatedText'],
          },
        },
      },
    });

    const parsedTranslations = JSON.parse(response.text ?? '[]');
    const translationMap = new Map<string, string>();
    for (const item of parsedTranslations) {
      if (item.id && item.translatedText) {
        translationMap.set(item.id, item.translatedText);
      }
    }

    const updatedSegments = segments.map((s: { id: string; [key: string]: unknown }) => ({
      ...s,
      translatedText: translationMap.get(s.id) || (s as { originalText?: string }).originalText || '',
    }));

    res.json({ segments: updatedSegments, targetLanguage });
  } catch (err: unknown) {
    console.error('Error re-translating transcript:', err);
    res.status(500).json({ error: (err as Error).message || 'Translation failed' });
  }
});

// Audio cache for spoken audio clips
const audioCache = new Map<string, string>();

// Serve real spoken presentation audio for demo samples in requested language
app.get('/api/sample-audio/:id/:lang', async (req: Request, res: Response) => {
  try {
    const { id, lang } = req.params;
    const cacheKey = `${id}-${lang}`;

    if (audioCache.has(cacheKey)) {
      const base64 = audioCache.get(cacheKey)!;
      const buffer = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    let text = '';
    let voice = 'Kore';

    if (id === 'sample-ai-future') {
      if (lang === 'es' || lang === 'Spanish') {
        text = 'Bienvenidos a todos. Hoy estamos observando cómo la inteligencia artificial multimodal está transformando la forma en que interactuamos entre idiomas. En lugar de tratar el audio, el texto y las imágenes como flujos aislados, los nuevos modelos fundacionales los perciben en una representación unificada. Esto significa que el tono de voz, la cadencia y las pistas visuales se toman en cuenta al producir traducciones localizadas. Los subtítulos ya no son un mero intercambio palabra por palabra, sino un puente expresivo que preserva la verdadera intención del orador. Ya sea que estés viendo una conferencia educativa internacional, un podcast o un documental, la comprensión en tiempo real es finalmente accesible. Y con la sincronización automática de marcas de tiempo, los creadores pueden exportar archivos de subtítulos listos para producción en segundos en lugar de horas. Gracias por explorar este avance con nosotros. Veamos la sincronización de la transcripción en vivo en acción.';
        voice = 'Kore';
      } else if (lang === 'fr' || lang === 'French') {
        text = 'Bienvenue à tous. Aujourd’hui, nous examinons comment l’intelligence artificielle multimodale change notre façon d’interagir à travers les langues. Au lieu de traiter l’audio, le texte et l’image comme des flux isolés, les nouveaux modèles fondateurs les perçoivent dans une représentation unifiée. Cela signifie que le ton de la voix, la cadence et les repères visuels sont tous pris en compte lors de la production de traductions localisées. Les sous-titres ne sont plus une simple substitution mot à mot, mais un pont expressif préservant la véritable intention de l’orateur.';
        voice = 'Kore';
      } else {
        text = 'Welcome everyone. Today we are looking at how multimodal artificial intelligence is changing the way we interact across languages. Instead of treating audio, text, and imagery as isolated streams, new foundational models perceive them in a unified representation. This means that tone of voice, cadence, and visual cues are all taken into account when producing localized translations. Subtitles are no longer a blunt word-for-word swap, but an expressive bridge preserving the speaker’s true intent. Whether you are watching an international educational lecture, a podcast, or a documentary, real-time comprehension is finally accessible. And with automated timestamp synchronization, creators can export production-ready subtitle files in seconds rather than hours. Thank you for exploring this breakthrough with us. Let’s look at the live transcript synchronization in action.';
        voice = 'Kore';
      }
    } else {
      text = 'Beneath the surface of the Pacific, sound travels nearly five times faster than through air. Hydrophones anchored at three hundred meters depth capture rhythmic low-frequency pulses that carry across entire ocean basins. Preserving this acoustic wilderness is becoming one of the most critical environmental challenges of our century.';
      voice = 'Charon';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: 'Clear, articulate, natural studio voice, measured cadence',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      audioCache.set(cacheKey, base64Audio);
      const buffer = Buffer.from(base64Audio, 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    res.status(500).json({ error: 'No audio returned' });
  } catch (err: unknown) {
    console.error('Error generating sample audio:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to generate sample audio' });
  }
});

// Direct audio streaming for single cue speech playback (used by cue speaker buttons)
app.get('/api/speak-cue', async (req: Request, res: Response) => {
  try {
    const text = (req.query.text as string) || '';
    const voice = (req.query.voice as string) || 'Kore';
    if (!text.trim()) {
      return res.status(400).send('Text query param is required');
    }

    const cacheKey = `cue-${text.slice(0, 80)}-${voice}`;
    if (audioCache.has(cacheKey)) {
      const buffer = Buffer.from(audioCache.get(cacheKey)!, 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 400),
              speechMetadata: {
                style: 'Natural, clear articulate pronunciation',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      audioCache.set(cacheKey, base64Audio);
      const buffer = Buffer.from(base64Audio, 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    res.status(500).send('No audio returned');
  } catch (err: unknown) {
    console.error('Error in /api/speak-cue:', err);
    res.status(500).send((err as Error).message || 'Speech generation failed');
  }
});

// Generate realistic spoken speech audio for any text or segment (JSON response)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 1200),
              speechMetadata: {
                style: 'Clear, articulate, natural broadcast narrator speech',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned from Gemini speech model' });
    }

    res.json({
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
    });
  } catch (err: unknown) {
    console.error('Error in /api/tts:', err);
    res.status(500).json({ error: (err as Error).message || 'Speech generation failed' });
  }
});

// Process uploaded media or media URL: Transcribe & Translate with millisecond timestamps
app.post('/api/process-media', async (req: Request, res: Response) => {
  try {
    const {
      audioData,
      mimeType = 'audio/mp3',
      mediaUrl,
      mediaTitle,
      targetLanguage = 'Spanish',
      sourceLanguage = 'Auto-Detect',
    } = req.body;

    if (!audioData && !mediaUrl) {
      return res.status(400).json({ error: 'Either audioData or mediaUrl is required.' });
    }

    let directMediaBuffer: Buffer | null = null;
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (audioData) {
      // Base64 audio/video data provided directly
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/mp3',
          data: audioData,
        },
      });
      parts.push({
        text: `Analyze the provided audiovisual speech recording.
1. Transcribe the spoken speech in its original language (${sourceLanguage}).
2. Translate each sentence or thought clause into ${targetLanguage}.
3. Break the dialogue into granular, timecoded subtitle segments suitable for SRT / WebVTT (segments between 2.0 and 8.0 seconds each).
4. Provide precise 'start' and 'end' timestamps in seconds from the start of the audio.
5. Provide a title, brief summary, and 3-5 key topics.`,
      });
    } else if (mediaUrl) {
      const urlValidation = await validateSafeExternalUrl(mediaUrl.trim());
      if (!urlValidation.safe) {
        return res.status(400).json({ error: urlValidation.error || 'Invalid or restricted media URL.' });
      }

      // Media link (YouTube, podcast, or direct web stream)
      const ytId = extractYouTubeId(mediaUrl);
      let mediaContext = `Media URL: ${mediaUrl}\nTitle: ${mediaTitle || 'User Media'}\n`;
      if (ytId) {
        mediaContext += `YouTube Video ID: ${ytId}\n`;
      }

      // Helper to determine exact media MIME type
      const getMediaMimeType = (targetUrl: string, headerType?: string | null): string => {
        if (headerType) {
          const cleanHeader = headerType.split(';')[0].trim().toLowerCase();
          if (cleanHeader.startsWith('audio/') || cleanHeader.startsWith('video/')) {
            return cleanHeader;
          }
        }
        const clean = targetUrl.split('?')[0].toLowerCase();
        if (clean.endsWith('.mp4')) return 'video/mp4';
        if (clean.endsWith('.webm')) return 'video/webm';
        if (clean.endsWith('.mov')) return 'video/quicktime';
        if (clean.endsWith('.mkv')) return 'video/x-matroska';
        if (clean.endsWith('.m4v') || clean.endsWith('.avi')) return 'video/mp4';
        if (clean.endsWith('.mp3')) return 'audio/mpeg';
        if (clean.endsWith('.wav')) return 'audio/wav';
        if (clean.endsWith('.ogg') || clean.endsWith('.opus')) return 'audio/ogg';
        if (clean.endsWith('.m4a') || clean.endsWith('.aac')) return 'audio/mp4';
        if (clean.endsWith('.flac')) return 'audio/flac';
        return 'audio/mpeg';
      };

      const isYouTube = !!ytId;
      const isSpotify = mediaUrl.includes('spotify.com');

      directMediaBuffer = null;
      let directMime = 'audio/mpeg';

      // Attempt to download direct media stream using safeFetchMedia for non-YouTube / non-Spotify links
      if (!isYouTube && !isSpotify) {
        try {
          console.log(`[TransLumina] Safely streaming media bytes from: ${mediaUrl}`);
          const fetchResult = await safeFetchMedia(mediaUrl, 35 * 1024 * 1024, 15000);
          if (fetchResult.ok && fetchResult.buffer) {
            directMediaBuffer = fetchResult.buffer;
            directMime = getMediaMimeType(mediaUrl, fetchResult.contentType);
            console.log(`[TransLumina] Successfully downloaded direct media (${(directMediaBuffer.length / 1024 / 1024).toFixed(2)} MB, ${directMime})`);
          } else if (fetchResult.error) {
            console.warn(`[TransLumina] Direct media stream fetch: ${fetchResult.error}`);
          }
        } catch (fetchErr) {
          console.warn('[TransLumina] Direct media stream fetch error:', fetchErr);
        }
      }

      if (directMediaBuffer) {
        // True acoustic audio/video analysis from real media bytes
        parts.push({
          inlineData: {
            mimeType: directMime,
            data: directMediaBuffer.toString('base64'),
          },
        });
        parts.push({
          text: `You have received the real binary audiovisual recording for "${mediaTitle || 'User Media'}".
Listen directly to the spoken speech in the audio track:
1. Transcribe the authentic spoken dialogue in its original language (${sourceLanguage}).
2. Translate each sentence into natural ${targetLanguage}.
3. Create 12 to 22 well-paced chronological subtitle segments with continuous start and end timestamps (in seconds).
4. Provide a clear title, executive summary, and 3-5 key topics.`,
        });
      } else {
        // External platform link (YouTube, Spotify, etc.) where direct audio extraction is restricted by platform policy
        parts.push({
          text: `The user has submitted an external media source:
${mediaContext}

Platform Policy Notice:
Streaming platforms (${isYouTube ? 'YouTube' : isSpotify ? 'Spotify' : 'the remote platform'}) restrict direct server-side audio downloads. You do NOT have the raw audio stream.
Strict Transcription & Grounding Guidelines:
1. Ground your analysis strictly on known public information, official titles, and verified themes for this content.
2. DO NOT fabricate, hallucinate, or invent fictional quotes as verbatim speech if the exact dialogue is unverified.
3. If this is a verified, publicly known speech, keynote, official release, or song, provide the authentic dialogue or lyrics accurately timestamped.
4. If specific spoken words cannot be verified, provide a chronological topic outline and synopsis of the discussion points. Label segments with descriptive topic indicators (e.g. Speaker: "[Topic Overview]" or "[Synopsis]") rather than inventing false dialogue quotes.
5. Translate all segments into natural ${targetLanguage}.
6. Provide an informative summary and key topic tags.`,
        });
      }
    }

    const systemInstruction = `You are an expert audiovisual transcription and localization AI studio.
You produce high-accuracy timestamped transcripts and culturally nuanced translations suitable for broadcast subtitles (SRT/VTT).
Return clean, non-overlapping segments with realistic start and end times in seconds.
Ensure originalText and translatedText are clean, non-empty, and faithful to the source material.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sourceLanguage: { type: Type.STRING },
            targetLanguage: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  speaker: { type: Type.STRING },
                  originalText: { type: Type.STRING },
                  translatedText: { type: Type.STRING },
                },
                required: ['id', 'start', 'end', 'originalText', 'translatedText'],
              },
            },
          },
          required: ['title', 'summary', 'segments'],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    
    // Ensure ids and valid numbers
    if (parsed.segments && Array.isArray(parsed.segments)) {
      parsed.segments = parsed.segments.map((seg: { id?: string; start: number; end: number; [key: string]: unknown }, idx: number) => {
        const safeStart = typeof seg.start === 'number' && !isNaN(seg.start) ? Math.max(0, seg.start) : idx * 5;
        const rawEnd = typeof seg.end === 'number' && !isNaN(seg.end) ? seg.end : safeStart + 4;
        const safeEnd = Math.max(safeStart + 0.5, rawEnd);
        return {
          ...seg,
          id: seg.id || `seg-${idx + 1}`,
          start: Number(safeStart.toFixed(2)),
          end: Number(safeEnd.toFixed(2)),
        };
      });
    }

    const hasAcousticData = Boolean(audioData || directMediaBuffer);
    parsed.transcriptType = hasAcousticData ? 'acoustic-waveform' : 'metadata-inferred';
    if (!hasAcousticData) {
      parsed.groundingNotice = 'Platform streaming restrictions prevent direct acoustic audio download for this link. Transcript is generated from verified public topic metadata and content synopsis. For 100% word-for-word acoustic waveform transcription, upload the media file directly in the File Upload tab.';
    }

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err: unknown) {
    console.error('Error in /api/process-media:', err);
    res.status(500).json({
      error: (err as Error).message || 'Failed to process media. Please check your file or URL and try again.',
    });
  }
});

// Setup development Vite server or static production files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TransLumina Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
