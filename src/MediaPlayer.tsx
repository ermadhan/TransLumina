/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Subtitles,
  Gauge,
  Mic,
  Globe,
  Radio
} from 'lucide-react';
import { formatDisplayTime } from './utils/exportFormats';
import { MediaMetadata, TranscriptSegment } from './types/transcript';

interface MediaPlayerProps {
  metadata: MediaMetadata;
  activeSegment: TranscriptSegment | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  seekTargetTime: number | null;
  onSeekComplete: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekRelative: (delta: number) => void;
}

export type AudioOutputMode = 'speech-original' | 'speech-translated' | 'ambient-stream';

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  metadata,
  activeSegment,
  currentTime,
  onTimeUpdate,
  seekTargetTime,
  onSeekComplete,
  isPlaying,
  onTogglePlay,
  onSeekRelative,
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(metadata.duration || 60);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showOverlayCaptions, setShowOverlayCaptions] = useState(true);

  // Audio track mode: Spoken Original Voice, Spoken Translated Dub, or Raw Media Stream
  const [audioMode, setAudioMode] = useState<AudioOutputMode>('speech-original');

  // Compute the exact spoken audio URL based on chosen mode
  const resolvedAudioSrc = useMemo(() => {
    const isSample = metadata.sourceType === 'sample' || metadata.id.startsWith('sample-');
    if (isSample) {
      if (audioMode === 'speech-translated') {
        return '/api/audio/sample-es.mp3';
      }
      return '/api/audio/sample-en.mp3';
    }

    return metadata.mediaUrl;
  }, [metadata, audioMode]);

  // When seekTargetTime changes, seek the underlying media element
  useEffect(() => {
    if (seekTargetTime !== null && mediaRef.current) {
      mediaRef.current.currentTime = seekTargetTime;
      onSeekComplete();
    }
  }, [seekTargetTime, onSeekComplete]);

  // Sync playback rate
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle native media events
  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      onTimeUpdate(mediaRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current && mediaRef.current.duration && !isNaN(mediaRef.current.duration)) {
      setDuration(mediaRef.current.duration);
    }
  };

  // Play or pause native media element according to isPlaying prop
  useEffect(() => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.play().catch(console.warn);
    } else {
      mediaRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = () => {
    onTogglePlay();
  };

  const seekRelative = (delta: number) => {
    onSeekRelative(delta);
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
      onTimeUpdate(val);
    }
  };

  // Switch audio track seamlessly while keeping current playback time
  const handleSwitchAudioMode = (mode: AudioOutputMode) => {
    setAudioMode(mode);
    if (mediaRef.current) {
      const savedTime = mediaRef.current.currentTime;
      const wasPlaying = isPlaying;
      setTimeout(() => {
        if (mediaRef.current) {
          mediaRef.current.currentTime = savedTime;
          if (wasPlaying) {
            mediaRef.current.play().catch(console.warn);
          }
        }
      }, 100);
    }
  };

  const isVideo = metadata.mediaType === 'video' || (metadata.mediaUrl && /\.(mp4|webm|mov)(\?.*)?$/i.test(metadata.mediaUrl));
  const isYouTube = metadata.mediaUrl && (metadata.mediaUrl.includes('youtube.com') || metadata.mediaUrl.includes('youtu.be'));

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Audio Track Selector Banner */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-semibold text-slate-300">Voice Audio Track:</span>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
          <button
            onClick={() => handleSwitchAudioMode('speech-original')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              audioMode === 'speech-original'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hear Dr. Vance speaking in English (Original Voice)"
          >
            <Mic className="w-3 h-3 text-cyan-300" />
            <span>Spoken Speech ({metadata.sourceLanguage})</span>
          </button>

          <button
            onClick={() => handleSwitchAudioMode('speech-translated')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              audioMode === 'speech-translated'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={`Hear spoken translation in ${metadata.targetLanguage}`}
          >
            <Globe className="w-3 h-3 text-emerald-300" />
            <span>Translated Dub ({metadata.targetLanguage})</span>
          </button>
        </div>
      </div>

      {/* Media Screen / Visualizer Viewport */}
      <div className="relative bg-black aspect-video sm:aspect-[16/9] flex items-center justify-center overflow-hidden">
        {isYouTube ? (
          <iframe
            src={`${metadata.mediaUrl?.replace('watch?v=', 'embed/')}?enablejsapi=1&autoplay=0`}
            title={metadata.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isVideo && metadata.mediaUrl ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={metadata.mediaUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => { if (!isPlaying) onTogglePlay(); }}
            onPause={() => { if (isPlaying) onTogglePlay(); }}
            className="w-full h-full object-contain"
            playsInline
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 relative">
            {resolvedAudioSrc && (
              <audio
                key={resolvedAudioSrc}
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={resolvedAudioSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => { if (!isPlaying) onTogglePlay(); }}
                onPause={() => { if (isPlaying) onTogglePlay(); }}
              />
            )}

            {/* Audio Waveform Atmosphere Animation */}
            <div className="flex items-center gap-1.5 h-16 sm:h-20 mb-4">
              {[40, 65, 30, 85, 95, 55, 75, 45, 90, 60, 35, 70, 85, 40].map((h, i) => (
                <div
                  key={i}
                  style={{ height: isPlaying ? `${Math.max(15, (h * (0.4 + (i % 3) * 0.3)))}%` : '20%' }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isPlaying ? 'bg-gradient-to-t from-indigo-500 to-cyan-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="text-center px-4 max-w-lg z-10">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                {audioMode === 'speech-translated'
                  ? `Dubbed Voice (${metadata.targetLanguage})`
                  : `${metadata.sourceLanguage} Spoken Voice`}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 line-clamp-1">
                {metadata.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {audioMode === 'speech-translated'
                  ? `Playing translated spoken voice in ${metadata.targetLanguage}`
                  : `Playing original spoken speaker narration in ${metadata.sourceLanguage}`}
              </p>
            </div>
          </div>
        )}

        {/* Closed Caption Overlay on Media Viewport */}
        {showOverlayCaptions && activeSegment && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex justify-center z-20">
            <div className="bg-black/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2.5 max-w-2xl text-center shadow-2xl transition-all">
              <p className="text-sm sm:text-base font-semibold text-white tracking-wide">
                {activeSegment.translatedText || activeSegment.originalText}
              </p>
              {activeSegment.translatedText && activeSegment.originalText !== activeSegment.translatedText && (
                <p className="text-xs text-indigo-300/80 mt-0.5 line-clamp-1">
                  {activeSegment.originalText}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-slate-800 space-y-3">
        {/* Timeline Scrubber */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleScrubberChange}
            aria-label="Media playback scrubber"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors"
          />
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 tabular-nums">
            <span>{formatDisplayTime(currentTime)}</span>
            <span>{formatDisplayTime(duration)}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left: Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => seekRelative(-5)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Rewind 5 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play Spoken Speech'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => seekRelative(5)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Forward 5 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Auxiliary Toggles */}
          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-xs">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                className="bg-transparent text-slate-200 font-mono focus:outline-none cursor-pointer"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
              </select>
            </div>

            {/* Subtitle Overlay Toggle */}
            <button
              onClick={() => setShowOverlayCaptions(!showOverlayCaptions)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                showOverlayCaptions
                  ? 'bg-indigo-950/80 border-indigo-700 text-indigo-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Subtitle Overlay on Video"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Mute Button */}
            <button
              onClick={() => {
                if (mediaRef.current) {
                  mediaRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
