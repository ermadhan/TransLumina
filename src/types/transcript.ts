/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TranscriptSegment {
  id: string;
  start: number;       // in seconds (e.g., 4.25)
  end: number;         // in seconds (e.g., 9.60)
  originalText: string;
  translatedText: string;
  speaker?: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  sourceType: 'file' | 'url' | 'sample';
  mediaUrl?: string;
  mediaType: 'audio' | 'video';
  sourceLanguage: string;
  targetLanguage: string;
  duration?: number;
  summary?: string;
  keyTopics?: string[];
  thumbnailUrl?: string;
  author?: string;
  createdAt: string;
}

export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'md' | 'json';
export type ExportLanguageMode = 'bilingual' | 'translated' | 'original';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'en', name: 'English', nativeName: 'English' },
];
