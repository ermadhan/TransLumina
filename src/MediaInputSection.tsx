/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Link2,
  UploadCloud,
  Sparkles,
  Youtube,
  Music,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  PlayCircle
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageOption } from './types/transcript';
import { SAMPLE_MEDIA_LIBRARY } from './utils/sampleData';
import { extractYouTubeId, getYouTubeThumbnailUrl } from './utils/youtube';

interface MediaInputSectionProps {
  onProcessFile: (file: File, sourceLang: string, targetLang: string) => Promise<void>;
  onProcessUrl: (url: string, sourceLang: string, targetLang: string) => Promise<void>;
  onSelectSample: (sampleId: string) => void;
  isProcessing: boolean;
  processingStage?: string;
}

export const MediaInputSection: React.FC<MediaInputSectionProps> = ({
  onProcessFile,
  onProcessUrl,
  onSelectSample,
  isProcessing,
  processingStage,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'sample'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [urlPreview, setUrlPreview] = useState<{
    type?: string;
    title?: string;
    author?: string;
    thumbnailUrl?: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAudioPreview, setFileAudioPreview] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('Auto-Detect');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [languageSearch, setLanguageSearch] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isInspectingUrl, setIsInspectingUrl] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track elapsed processing time to give users transparent real-time feedback
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  // Derive dynamic progress stage based on elapsed time and current stage
  const dynamicStageInfo = React.useMemo(() => {
    if (!isProcessing) return null;
    if (elapsedSeconds < 4) {
      return {
        step: '1/4',
        label: 'Inspecting media stream & resolving audio track',
        progress: 25,
      };
    } else if (elapsedSeconds < 9) {
      return {
        step: '2/4',
        label: 'Analyzing speech cadence & identifying speakers',
        progress: 50,
      };
    } else if (elapsedSeconds < 16) {
      return {
        step: '3/4',
        label: `Synthesizing timestamped dialogue with Gemini 3.8 Flash`,
        progress: 75,
      };
    } else {
      return {
        step: '4/4',
        label: `Translating into ${targetLanguage} & formatting subtitle timecodes`,
        progress: 90,
      };
    }
  }, [isProcessing, elapsedSeconds, targetLanguage]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL Inspection when user types or pastes
  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    setInputError(null);

    if (!val.trim()) {
      setUrlPreview(null);
      return;
    }

    const ytId = extractYouTubeId(val);
    if (ytId) {
      setIsInspectingUrl(true);
      // Immediately set provisional preview with thumbnail while inspecting
      setUrlPreview({
        type: 'youtube',
        title: val.includes('/shorts/') ? 'YouTube Short' : 'YouTube Video',
        thumbnailUrl: getYouTubeThumbnailUrl(ytId),
      });

      try {
        const res = await fetch('/api/extract-url-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: val }),
        });
        if (res.ok) {
          const data = await res.json();
          setUrlPreview(data);
        }
      } catch (err) {
        console.warn('URL inspection error:', err);
      } finally {
        setIsInspectingUrl(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInputError(null);
    setSelectedFile(file);

    // Create object URL for local audio preview
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setFileAudioPreview(url);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setInputError(null);
      setSelectedFile(file);
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setFileAudioPreview(url);
      }
    }
  };

  const handleSubmit = async () => {
    setInputError(null);
    try {
      if (activeTab === 'url') {
        if (!urlInput.trim()) {
          setInputError('Please enter a YouTube, Spotify, or media URL.');
          return;
        }
        await onProcessUrl(urlInput.trim(), sourceLanguage, targetLanguage);
      } else if (activeTab === 'file') {
        if (!selectedFile) {
          setInputError('Please select or drop an audio or video file to proceed.');
          return;
        }
        await onProcessFile(selectedFile, sourceLanguage, targetLanguage);
      }
    } catch (err: unknown) {
      setInputError((err as Error).message || 'Processing failed. Please check inputs.');
    }
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(languageSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(languageSearch.toLowerCase())
  );

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Transcribe & Translate Media
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Multimodal speech recognition and subtitle localization powered by Gemini.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => {
              setActiveTab('url');
              setInputError(null);
            }}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'url'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Media Link</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('file');
              setInputError(null);
            }}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>File Upload</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('sample');
              setInputError(null);
            }}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'sample'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Quick Samples</span>
          </button>
        </div>
      </div>

      {/* Main Tab View */}
      <div className="mt-6">
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="media-url-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                YouTube, Spotify, or Direct Media URL
              </label>
              <div className="relative">
                <input
                  id="media-url-input"
                  type="url"
                  value={urlInput}
                  onChange={handleUrlChange}
                  placeholder="https://www.youtube.com/watch?v=... or direct audio/video link"
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-12 font-mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500">
                  {isInspectingUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Youtube className="w-4 h-4 hover:text-rose-400 transition-colors" />
                      <Music className="w-4 h-4 hover:text-emerald-400 transition-colors" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                <span>Supports YouTube</span>
                <span aria-hidden="true">·</span>
                <span>YouTube Music</span>
                <span aria-hidden="true">·</span>
                <span>Spotify Episodes</span>
                <span aria-hidden="true">·</span>
                <span>Direct MP3/MP4/WAV</span>
              </div>
            </div>

            {/* Quick preset links for immediate 1-click test */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-400">Try testing with:</span>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                  setUrlPreview({
                    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
                    author: 'Rick Astley',
                    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                    type: 'youtube',
                  });
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Music Video (YouTube)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('https://www.youtube.com/watch?v=kXh47E_48sM');
                  setUrlPreview({
                    title: 'The AI Revolution & Language Localization',
                    author: 'Tech Insights',
                    type: 'youtube',
                  });
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                TED-Style Talk (YouTube)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('https://www.youtube.com/shorts/a-Mui2QYF-0');
                  setUrlPreview({
                    title: 'YouTube Short (a-Mui2QYF-0)',
                    author: 'Creator',
                    thumbnailUrl: 'https://img.youtube.com/vi/a-Mui2QYF-0/hqdefault.jpg',
                    type: 'youtube',
                  });
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-colors cursor-pointer"
              >
                YouTube Short (a-Mui2QYF-0)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=creative-technology-showcase-11157.mp3');
                  setUrlPreview({
                    title: 'Creative Technology Keynote Audio Stream',
                    author: 'Audio Studio',
                    type: 'direct-audio',
                  });
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Direct MP3 Audio Stream
              </button>
            </div>

            {/* Processing Duration Note */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-slate-300">Processing Time Note: </span>
                Extracting dialogue, determining speaker turns, generating millisecond-precise subtitle timecodes, and translating into the target language typically takes <strong>10 to 25 seconds</strong>. For instantaneous 0-second testing, check the <strong className="text-indigo-400">Quick Samples</strong> tab.
              </div>
            </div>

            {/* URL Preview Card */}
            {urlPreview && (
              <div className="flex items-center gap-4 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                {urlPreview.thumbnailUrl ? (
                  <img
                    src={urlPreview.thumbnailUrl}
                    alt={urlPreview.title || 'Preview'}
                    className="w-16 h-12 object-cover rounded-lg shrink-0 border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
                    <PlayCircle className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{urlPreview.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{urlPreview.author || 'Ready for transcription'}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Detected</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'file' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-900/40 hover:bg-slate-900/80 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.mp4,.m4a,.webm,.ogg,.flac"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click to upload or drag & drop audio or video'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  MP3, WAV, MP4, M4A, WebM, OGG, FLAC (up to 50MB)
                </p>
              </div>
            </div>

            {/* Selected File Details & Audio Preview */}
            {selectedFile && (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · {selectedFile.type || 'audio/video'}
                    </p>
                  </div>
                </div>

                {fileAudioPreview && (
                  <audio
                    src={fileAudioPreview}
                    controls
                    className="h-8 max-w-[240px] rounded"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sample' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Select one of our verified, high-accuracy multilingual sample recordings to inspect live synchronized subtitles and test exports immediately:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SAMPLE_MEDIA_LIBRARY.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => onSelectSample(sample.id)}
                  className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                        {sample.metadata.mediaType} · {sample.metadata.duration}s
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {sample.segments.length} segments
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors mt-2">
                      {sample.metadata.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                      {sample.metadata.summary}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-indigo-400">
                    <span>{sample.metadata.sourceLanguage} → {sample.metadata.targetLanguage}</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Load in Studio <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Language Configuration & Process Action */}
      {activeTab !== 'sample' && (
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Source Language */}
          <div>
            <label htmlFor="source-lang-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Source Language
            </label>
            <select
              id="source-lang-select"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Auto-Detect">✨ Auto-Detect Speech</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={`src-${l.code}`} value={l.name}>
                  {l.name} ({l.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* Target Language */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="target-lang-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Target Translation
              </label>
              <input
                type="text"
                value={languageSearch}
                onChange={(e) => setLanguageSearch(e.target.value)}
                placeholder="Filter languages..."
                className="text-[11px] bg-slate-800/80 border border-slate-700 rounded px-2 py-0.5 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28"
              />
            </div>
            <select
              id="target-lang-select"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {filteredLanguages.map((l) => (
                <option key={`tgt-${l.code}`} value={l.name}>
                  {l.name} ({l.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className={`w-full py-2.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                isProcessing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>{dynamicStageInfo ? `Processing (${elapsedSeconds}s)...` : (processingStage || 'Processing Media...')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Translate & Transcribe</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Processing Multi-Stage Indicator */}
      {isProcessing && dynamicStageInfo && (
        <div className="mt-6 p-4 sm:p-5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-200">
                Step {dynamicStageInfo.step}
              </span>
              <span>{dynamicStageInfo.label}</span>
            </div>
            <div className="font-mono text-slate-400 flex items-center gap-1.5 self-end sm:self-auto">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{elapsedSeconds}s elapsed</span>
              <span className="text-slate-500">· typical 10–25s</span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${dynamicStageInfo.progress}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Multimodal Gemini AI is parsing full dialogue and calculating millisecond-precise subtitle timecodes in dual languages. Subtitles and audio tracks will appear automatically once complete.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {inputError && (
        <div className="mt-4 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center gap-3 text-rose-200 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{inputError}</span>
        </div>
      )}
    </div>
  );
};
