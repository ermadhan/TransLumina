/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsing with generous limit for audio/video media uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

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
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1];
      }
      if (parsed.pathname.startsWith('/v/')) {
        return parsed.pathname.split('/v/')[1];
      }
    } else if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }
  } catch {
    // If not a full URL, check for standard 11-char regex
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }
  return null;
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
      // Media link (YouTube, podcast, or direct web stream)
      const ytId = extractYouTubeId(mediaUrl);
      let mediaContext = `Media URL: ${mediaUrl}\nTitle: ${mediaTitle || 'User Media'}\n`;
      if (ytId) {
        mediaContext += `YouTube Video ID: ${ytId}\n`;
      }

      parts.push({
        text: `The user has submitted an audiovisual media source to transcribe and translate:
${mediaContext}

Instructions:
1. Provide a comprehensive, accurate spoken transcript of this media in the source language (${sourceLanguage}).
2. Translate every spoken line into ${targetLanguage}.
3. Create realistic chronological subtitle segments with continuous, non-overlapping timestamps ('start' and 'end' in seconds, starting from 0.0s).
4. Each segment should contain between 4 and 15 words, natural for subtitle readers.
5. Identify speakers if distinct (e.g., 'Speaker 1', 'Host', 'Narrator').
6. Provide an informative summary and key topic tags.`,
      });
    }

    const systemInstruction = `You are a professional audiovisual transcription and localization AI studio.
You produce high-accuracy timestamped transcripts and culturally nuanced translations suitable for broadcast subtitles (SRT/VTT).
Ensure 'start' and 'end' are numbers in seconds (e.g. 0.0, 4.5).
Ensure originalText and translatedText are clean and non-empty.`;

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
      parsed.segments = parsed.segments.map((seg: { id?: string; start: number; end: number; [key: string]: unknown }, idx: number) => ({
        ...seg,
        id: seg.id || `seg-${idx + 1}`,
        start: typeof seg.start === 'number' && !isNaN(seg.start) ? Math.max(0, seg.start) : idx * 5,
        end: typeof seg.end === 'number' && !isNaN(seg.end) ? Math.max(seg.start + 1, seg.end) : (idx + 1) * 5,
      }));
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
