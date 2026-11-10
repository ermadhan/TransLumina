/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './Header';
import { MediaInputSection } from './MediaInputSection';
import { MediaPlayer } from './MediaPlayer';
import { BilingualTranscriptView } from './BilingualTranscriptView';
import { SummaryCard } from './SummaryCard';
import { ExportModal } from './ExportModal';
import { TranscriptSegment, MediaMetadata } from './types/transcript';
import { SAMPLE_MEDIA_LIBRARY } from './utils/sampleData';
import { extractYouTubeId, getYouTubeThumbnailUrl } from './utils/youtube';
import { Download, PlusCircle, Wand2, FileAudio } from 'lucide-react';

export default function App() {
  // Preload initial sample project so workstation is immediately populated and usable
  const defaultSample = SAMPLE_MEDIA_LIBRARY[0];
  const [currentMetadata, setCurrentMetadata] = useState<MediaMetadata>(defaultSample.metadata);
  const [segments, setSegments] = useState<TranscriptSegment[]>(defaultSample.segments);

  // Playback & Timing state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);

  // Processing & Modal state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [isRetranslating, setIsRetranslating] = useState<boolean>(false);
  const [showInputPanel, setShowInputPanel] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [globalNotification, setGlobalNotification] = useState<string | null>(null);

  // Determine active segment based on current playback time
  const activeSegment = useMemo(() => {
    return (
      segments.find((seg) => currentTime >= seg.start && currentTime <= seg.end) || null
    );
  }, [segments, currentTime]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeekRelative = (delta: number) => {
    const newTime = Math.max(0, currentTime + delta);
    setSeekTargetTime(newTime);
    setCurrentTime(newTime);
  };

  // Handle Seeking
  const handleSeek = (time: number) => {
    setSeekTargetTime(time);
    setCurrentTime(time);
  };

  const handleSeekComplete = () => {
    setSeekTargetTime(null);
  };

  // Process File Upload via Server Endpoint
  const handleProcessFile = async (file: File, sourceLang: string, targetLang: string) => {
    setIsProcessing(true);
    setProcessingStage('Encoding & Uploading Media...');
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data:mime/type;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProcessingStage('Transcribing speech with Gemini...');

      const response = await fetch('/api/process-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Data,
          mimeType: file.type || 'audio/mp3',
          mediaTitle: file.name,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server processing failed');
      }

      const result = await response.json();
      const parsed = result.data;

      const fileUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');

      setCurrentMetadata({
        id: `upload-${Date.now()}`,
        title: parsed.title || file.name,
        sourceType: 'file',
        mediaUrl: fileUrl,
        mediaType: isVideo ? 'video' : 'audio',
        sourceLanguage: parsed.sourceLanguage || sourceLang,
        targetLanguage: parsed.targetLanguage || targetLang,
        duration: parsed.segments?.[parsed.segments.length - 1]?.end || 60,
        summary: parsed.summary,
        keyTopics: parsed.keyTopics,
        createdAt: new Date().toISOString(),
      });

      setSegments(parsed.segments || []);
      setCurrentTime(0);
      setShowInputPanel(false);
      setGlobalNotification(`Successfully transcribed & translated to ${targetLang}!`);
      setTimeout(() => setGlobalNotification(null), 4000);
    } catch (err: unknown) {
      console.error('File processing error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Process Media URL (YouTube, Spotify, Web Stream)
  const handleProcessUrl = async (url: string, sourceLang: string, targetLang: string) => {
    setIsProcessing(true);
    setProcessingStage('Inspecting Media Stream...');
    try {
      // First extract URL information
      const infoRes = await fetch('/api/extract-url-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const urlInfo = infoRes.ok ? await infoRes.json() : {};

      setProcessingStage('Generating timestamped transcript with Gemini...');

      const response = await fetch('/api/process-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: url,
          mediaTitle: urlInfo.title || url,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to process media URL');
      }

      const result = await response.json();
      const parsed = result.data;

      const ytId = extractYouTubeId(url);
      const isYouTube = !!ytId;
      const isVideo = isYouTube || /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

      setCurrentMetadata({
        id: `url-${Date.now()}`,
        title: parsed.title || urlInfo.title || (isYouTube ? 'YouTube Video' : 'Online Media'),
        sourceType: 'url',
        mediaUrl: url,
        mediaType: isVideo ? 'video' : 'audio',
        sourceLanguage: parsed.sourceLanguage || sourceLang,
        targetLanguage: parsed.targetLanguage || targetLang,
        duration: parsed.segments?.[parsed.segments.length - 1]?.end || 90,
        summary: parsed.summary,
        keyTopics: parsed.keyTopics,
        author: urlInfo.author,
        thumbnailUrl: urlInfo.thumbnailUrl || (ytId ? getYouTubeThumbnailUrl(ytId) : undefined),
        createdAt: new Date().toISOString(),
      });

      setSegments(parsed.segments || []);
      setCurrentTime(0);
      setShowInputPanel(false);
      setGlobalNotification(`Processed & translated to ${targetLang}!`);
      setTimeout(() => setGlobalNotification(null), 4000);
    } catch (err: unknown) {
      console.error('URL processing error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Load a Preloaded Sample
  const handleSelectSample = (sampleId: string) => {
    const found = SAMPLE_MEDIA_LIBRARY.find((s) => s.id === sampleId) || defaultSample;
    setCurrentMetadata(found.metadata);
    setSegments(found.segments);
    setCurrentTime(0);
    setShowInputPanel(false);
    setGlobalNotification(`Loaded demo: "${found.metadata.title}"`);
    setTimeout(() => setGlobalNotification(null), 3000);
  };

  // Re-translate current transcript to a new target language on the fly
  const handleChangeTargetLanguage = async (newLanguage: string) => {
    if (newLanguage === currentMetadata.targetLanguage) return;

    // Check if the current sample has cached translations for instant switch
    const currentSample = SAMPLE_MEDIA_LIBRARY.find((s) => s.id === currentMetadata.id);
    if (currentSample && currentSample.translations[newLanguage]) {
      setSegments(currentSample.translations[newLanguage]);
      setCurrentMetadata((prev) => ({ ...prev, targetLanguage: newLanguage }));
      setGlobalNotification(`Switched subtitles to ${newLanguage}!`);
      setTimeout(() => setGlobalNotification(null), 3000);
      return;
    }

    setIsRetranslating(true);
    try {
      const res = await fetch('/api/translate-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          targetLanguage: newLanguage,
        }),
      });

      if (!res.ok) {
        throw new Error('Re-translation request failed');
      }

      const data = await res.json();
      setSegments(data.segments);
      setCurrentMetadata((prev) => ({ ...prev, targetLanguage: newLanguage }));
      setGlobalNotification(`Subtitles translated to ${newLanguage}!`);
      setTimeout(() => setGlobalNotification(null), 3000);
    } catch (err) {
      console.error('Re-translation error:', err);
      setGlobalNotification('Translation failed. Please try again.');
      setTimeout(() => setGlobalNotification(null), 3000);
    } finally {
      setIsRetranslating(false);
    }
  };

  const handleUpdateSegment = (updated: TranscriptSegment) => {
    setSegments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <Header
        onNewMedia={() => setShowInputPanel(!showInputPanel)}
        onOpenExport={() => setIsExportModalOpen(true)}
        hasActiveTranscript={segments.length > 0}
        onLoadSample={() => handleSelectSample(defaultSample.id)}
      />

      {/* Global Notification Toast */}
      {globalNotification && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-indigo-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>{globalNotification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toggleable Media Input Section */}
        {showInputPanel && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-200">
            <MediaInputSection
              onProcessFile={handleProcessFile}
              onProcessUrl={handleProcessUrl}
              onSelectSample={handleSelectSample}
              isProcessing={isProcessing}
              processingStage={processingStage}
            />
          </div>
        )}

        {/* Studio Workspace Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>TransLumina Studio</span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-200 font-medium">Bilingual Playback Workstation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
              {currentMetadata.title}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setShowInputPanel(!showInputPanel)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                showInputPanel
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>{showInputPanel ? 'Close Uploader' : 'Add Media Source'}</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Export Subtitles</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Media Player & Summary (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            <MediaPlayer
              metadata={currentMetadata}
              activeSegment={activeSegment}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              seekTargetTime={seekTargetTime}
              onSeekComplete={handleSeekComplete}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onSeekRelative={handleSeekRelative}
            />

            <SummaryCard
              metadata={currentMetadata}
              segmentCount={segments.length}
            />
          </div>

          {/* Right Column: Synchronized Bilingual Transcript (7 columns) */}
          <div className="lg:col-span-7 h-[680px]">
            <BilingualTranscriptView
              segments={segments}
              activeSegmentId={activeSegment?.id || null}
              onSeek={handleSeek}
              onUpdateSegment={handleUpdateSegment}
              targetLanguage={currentMetadata.targetLanguage}
              sourceLanguage={currentMetadata.sourceLanguage}
              onChangeTargetLanguage={handleChangeTargetLanguage}
              isRetranslating={isRetranslating}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onSeekRelative={handleSeekRelative}
            />
          </div>
        </div>
      </main>

      {/* Export Subtitles & Documents Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        segments={segments}
        metadata={currentMetadata}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0B0F19] py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 TransLumina Subtitle Studio · Multilingual Media Intelligence</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>SRT & WebVTT Generator</span>
            <span aria-hidden="true">·</span>
            <span>Millisecond Precision</span>
            <span aria-hidden="true">·</span>
            <span>50+ Languages</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
