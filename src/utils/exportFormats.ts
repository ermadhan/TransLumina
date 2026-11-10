/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TranscriptSegment, MediaMetadata, ExportLanguageMode } from '../types/transcript';

export function formatSecondsToSRTTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, isNaN(totalSeconds) ? 0 : totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.floor((safeSeconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
}

export function formatSecondsToVTTTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, isNaN(totalSeconds) ? 0 : totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.floor((safeSeconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
}

export function formatDisplayTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, isNaN(totalSeconds) ? 0 : totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

function resolveSegmentText(segment: TranscriptSegment, mode: ExportLanguageMode): string {
  if (mode === 'translated') {
    return segment.translatedText || segment.originalText;
  }
  if (mode === 'original') {
    return segment.originalText;
  }
  // Bilingual: Translated on line 1, Original on line 2 (standard dual-subtitle layout)
  if (segment.translatedText && segment.originalText && segment.translatedText !== segment.originalText) {
    return `${segment.translatedText}\n${segment.originalText}`;
  }
  return segment.translatedText || segment.originalText;
}

export function generateSRT(segments: TranscriptSegment[], mode: ExportLanguageMode): string {
  return segments
    .map((seg, idx) => {
      const index = idx + 1;
      const start = formatSecondsToSRTTime(seg.start);
      const end = formatSecondsToSRTTime(seg.end);
      const text = resolveSegmentText(seg, mode);
      return `${index}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
}

export function generateVTT(segments: TranscriptSegment[], mode: ExportLanguageMode): string {
  let output = 'WEBVTT\n\nNOTE Created by TransLumina Subtitle Studio\n\n';
  output += segments
    .map((seg, idx) => {
      const index = idx + 1;
      const start = formatSecondsToVTTTime(seg.start);
      const end = formatSecondsToVTTTime(seg.end);
      const text = resolveSegmentText(seg, mode);
      return `${index}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
  return output;
}

export function generateTXT(
  segments: TranscriptSegment[],
  mode: ExportLanguageMode,
  withTimestamps = true
): string {
  return segments
    .map((seg) => {
      const timecode = withTimestamps ? `[${formatDisplayTime(seg.start)} - ${formatDisplayTime(seg.end)}] ` : '';
      const speaker = seg.speaker ? `${seg.speaker}: ` : '';
      const translated = (seg.translatedText && seg.translatedText.trim()) || seg.originalText;
      if (mode === 'bilingual') {
        return `${timecode}${speaker}${translated}\n${withTimestamps ? '        ' : ''}(Original: ${seg.originalText})\n`;
      } else if (mode === 'translated') {
        return `${timecode}${speaker}${translated}`;
      } else {
        return `${timecode}${speaker}${seg.originalText}`;
      }
    })
    .join('\n');
}

export function generateMarkdown(
  segments: TranscriptSegment[],
  mode: ExportLanguageMode,
  metadata?: MediaMetadata
): string {
  const title = metadata?.title || 'Media Transcript';
  const srcLang = metadata?.sourceLanguage || 'Original';
  const tgtLang = metadata?.targetLanguage || 'Translated';

  let md = `# ${title}\n\n`;
  md += `**Source**: ${metadata?.sourceType === 'url' ? metadata.mediaUrl : (metadata?.title || 'Uploaded media')}\n`;
  md += `**Languages**: ${srcLang} → ${tgtLang}\n`;
  md += `**Export Mode**: ${mode.toUpperCase()}\n`;
  md += `**Date Processed**: ${metadata?.createdAt ? new Date(metadata.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}\n\n`;

  if (metadata?.summary) {
    md += `## Summary\n\n> ${metadata.summary}\n\n`;
  }

  if (metadata?.keyTopics && metadata.keyTopics.length > 0) {
    md += `### Key Topics\n\n`;
    metadata.keyTopics.forEach((t) => {
      md += `- ${t}\n`;
    });
    md += '\n';
  }

  md += `## Synchronized Transcript\n\n`;

  if (mode === 'bilingual') {
    md += `| Timecode | Translated (${tgtLang}) | Original (${srcLang}) |\n`;
    md += `| :--- | :--- | :--- |\n`;
    segments.forEach((seg) => {
      const time = `\`${formatDisplayTime(seg.start)} - ${formatDisplayTime(seg.end)}\``;
      const trans = (seg.translatedText && seg.translatedText.trim()) || seg.originalText;
      const cleanTrans = trans.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const cleanOrig = (seg.originalText || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${time} | ${cleanTrans} | ${cleanOrig} |\n`;
    });
  } else {
    segments.forEach((seg) => {
      const time = `\`${formatDisplayTime(seg.start)}\``;
      const trans = (seg.translatedText && seg.translatedText.trim()) || seg.originalText;
      const text = mode === 'translated' ? trans : seg.originalText;
      const speaker = seg.speaker ? `**${seg.speaker}**: ` : '';
      md += `- ${time} ${speaker}${text}\n`;
    });
  }

  return md;
}

export function generateJSON(segments: TranscriptSegment[], metadata?: MediaMetadata): string {
  return JSON.stringify(
    {
      metadata: metadata || null,
      segments,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
