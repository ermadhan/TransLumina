/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
  Radio,
  ExternalLink
} from 'lucide-react';
import { formatDisplayTime } from './utils/exportFormats';
import { MediaMetadata, TranscriptSegment } from './types/transcript';
import { extractYouTubeId, getYouTubeEmbedUrl } from './utils/youtube';

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

// Declare YouTube Iframe API types for TypeScript
declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: any }) => void;
            onStateChange?: (event: { data: number; target: any }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => any;
      PlayerState?: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [duration, setDuration] = useState(metadata.duration || 60);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showOverlayCaptions, setShowOverlayCaptions] = useState(true);
  const [audioMode, setAudioMode] = useState<AudioOutputMode>('speech-original');

  // Identify YouTube videos and Shorts
  const ytVideoId = useMemo(() => {
    return extractYouTubeId(metadata.mediaUrl || '');
  }, [metadata.mediaUrl]);

  const isYouTube = !!ytVideoId;
  const isShort = useMemo(() => {
    return !!metadata.mediaUrl && (metadata.mediaUrl.includes('/shorts/') || metadata.mediaUrl.includes('shorts'));
  }, [metadata.mediaUrl]);

  const isVideo = !isYouTube && (metadata.mediaType === 'video' || (metadata.mediaUrl && /\.(mp4|webm|mov)(\?.*)?$/i.test(metadata.mediaUrl)));

  // Generate safe embed URL
  const ytEmbedUrl = useMemo(() => {
    if (!ytVideoId) return '';
    return getYouTubeEmbedUrl(ytVideoId, { autoplay: false });
  }, [ytVideoId]);

  // Direct postMessage sender to control YouTube iframe immediately
  const sendYouTubeCommand = useCallback((func: string, args: unknown[] = []) => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch (err) {
        console.warn('postMessage to YouTube failed:', err);
      }
    }
  }, []);

  // Compute the audio URL for local sample speech
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

  // Sync Duration when metadata updates
  useEffect(() => {
    if (metadata.duration && metadata.duration > 0) {
      setDuration(metadata.duration);
    }
  }, [metadata.duration]);

  // Initialize YouTube Iframe Player API
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;

    let isSubscribed = true;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !iframeRef.current) return;
      try {
        ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              if (!isSubscribed) return;
              try {
                const dur = event.target.getDuration();
                if (dur && !isNaN(dur) && dur > 0) {
                  setDuration(dur);
                }
                if (isMuted) {
                  event.target.mute();
                }
                if (playbackRate !== 1) {
                  event.target.setPlaybackRate(playbackRate);
                }
              } catch (e) {
                console.warn('YouTube onReady error:', e);
              }
            },
            onStateChange: (event) => {
              if (!isSubscribed) return;
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === 1 && !isPlayingRef.current) {
                onTogglePlay();
              } else if ((event.data === 2 || event.data === 0) && isPlayingRef.current) {
                onTogglePlay();
              }
            },
          },
        });
      } catch (err) {
        console.warn('Error instantiating YouTube Player API:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Load YouTube API script if not present
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        if (isSubscribed) initPlayer();
      };
    }

    return () => {
      isSubscribed = false;
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
      ytPlayerRef.current = null;
    };
  }, [isYouTube, ytVideoId, onTogglePlay]);

  // Handle Play / Pause commands across YouTube, native Video, and Audio
  useEffect(() => {
    if (isYouTube) {
      if (isPlaying) {
        if (ytPlayerRef.current?.playVideo) {
          try { ytPlayerRef.current.playVideo(); } catch { sendYouTubeCommand('playVideo'); }
        } else {
          sendYouTubeCommand('playVideo');
        }
      } else {
        if (ytPlayerRef.current?.pauseVideo) {
          try { ytPlayerRef.current.pauseVideo(); } catch { sendYouTubeCommand('pauseVideo'); }
        } else {
          sendYouTubeCommand('pauseVideo');
        }
      }
    } else if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.play().catch(console.warn);
      } else {
        mediaRef.current.pause();
      }
    }
  }, [isPlaying, isYouTube, sendYouTubeCommand]);

  // Handle Seeking across YouTube and Native Media
  useEffect(() => {
    if (seekTargetTime !== null) {
      if (isYouTube) {
        if (ytPlayerRef.current?.seekTo) {
          try { ytPlayerRef.current.seekTo(seekTargetTime, true); } catch { sendYouTubeCommand('seekTo', [seekTargetTime, true]); }
        } else {
          sendYouTubeCommand('seekTo', [seekTargetTime, true]);
        }
        onTimeUpdate(seekTargetTime);
        onSeekComplete();
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = seekTargetTime;
        onSeekComplete();
      }
    }
  }, [seekTargetTime, isYouTube, onSeekComplete, onTimeUpdate, sendYouTubeCommand]);

  // Sync playback rate
  useEffect(() => {
    if (isYouTube) {
      if (ytPlayerRef.current?.setPlaybackRate) {
        try { ytPlayerRef.current.setPlaybackRate(playbackRate); } catch { sendYouTubeCommand('setPlaybackRate', [playbackRate]); }
      } else {
        sendYouTubeCommand('setPlaybackRate', [playbackRate]);
      }
    } else if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isYouTube, sendYouTubeCommand]);

  // Sync mute state and Voice Audio mode (mute YouTube video when playing translated dub voice)
  useEffect(() => {
    const shouldMute = isMuted || (isYouTube && audioMode === 'speech-translated');
    if (isYouTube) {
      if (ytPlayerRef.current) {
        try {
          if (shouldMute) ytPlayerRef.current.mute();
          else ytPlayerRef.current.unMute();
        } catch {
          sendYouTubeCommand(shouldMute ? 'mute' : 'unMute');
        }
      } else {
        sendYouTubeCommand(shouldMute ? 'mute' : 'unMute');
      }
    } else if (mediaRef.current) {
      mediaRef.current.muted = shouldMute;
    }
  }, [isMuted, audioMode, isYouTube, sendYouTubeCommand]);

  // Time tracking ticker for YouTube playback
  useEffect(() => {
    if (!isYouTube || !isPlaying) return;

    const interval = setInterval(() => {
      let updatedTime: number | null = null;
      if (ytPlayerRef.current?.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t) && t >= 0) {
            updatedTime = t;
          }
        } catch {
          // ignore
        }
      }

      if (updatedTime !== null) {
        onTimeUpdate(updatedTime);
      } else {
        // Fallback clock tick
        onTimeUpdate(Math.min(duration, currentTime + 0.25));
      }

      // Check duration
      if (ytPlayerRef.current?.getDuration) {
        try {
          const dur = ytPlayerRef.current.getDuration();
          if (dur && !isNaN(dur) && dur > 0 && dur !== duration) {
            setDuration(dur);
          }
        } catch {
          // ignore
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isYouTube, isPlaying, duration, currentTime, onTimeUpdate]);

  // Native media events (video / audio tags)
  const handleNativeTimeUpdate = () => {
    if (mediaRef.current) {
      onTimeUpdate(mediaRef.current.currentTime);
    }
  };

  const handleNativeLoadedMetadata = () => {
    if (mediaRef.current?.duration && !isNaN(mediaRef.current.duration)) {
      setDuration(mediaRef.current.duration);
    }
  };

  // Scrubber scrubbing
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onTimeUpdate(val);
    if (isYouTube) {
      if (ytPlayerRef.current?.seekTo) {
        try { ytPlayerRef.current.seekTo(val, true); } catch { sendYouTubeCommand('seekTo', [val, true]); }
      } else {
        sendYouTubeCommand('seekTo', [val, true]);
      }
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
  };

  // Relative Seek button (±5s)
  const handleSeekRelative = (delta: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    onSeekRelative(delta);
    if (isYouTube) {
      if (ytPlayerRef.current?.seekTo) {
        try { ytPlayerRef.current.seekTo(newTime, true); } catch { sendYouTubeCommand('seekTo', [newTime, true]); }
      } else {
        sendYouTubeCommand('seekTo', [newTime, true]);
      }
    } else if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
    }
  };

  // Audio Mode toggle
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

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Audio Track Selector Banner */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-semibold text-slate-300">
            {isYouTube ? (isShort ? 'YouTube Short Sync:' : 'YouTube Audio Track:') : 'Voice Audio Track:'}
          </span>
          {isYouTube && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
              {isShort ? '9:16 Shorts' : 'YouTube Sync'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
          <button
            onClick={() => handleSwitchAudioMode('speech-original')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              audioMode === 'speech-original'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hear original spoken audio in source language"
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
          <div className="w-full h-full flex items-center justify-center bg-black">
            {isShort ? (
              // YouTube Shorts vertical 9:16 container
              <div className="h-full aspect-[9/16] max-w-[340px] mx-auto bg-black relative shadow-2xl border-x border-slate-800">
                <iframe
                  ref={iframeRef}
                  id="translumina-yt-player"
                  src={ytEmbedUrl}
                  title={metadata.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              // Standard 16:9 YouTube video
              <iframe
                ref={iframeRef}
                id="translumina-yt-player"
                src={ytEmbedUrl}
                title={metadata.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        ) : isVideo && metadata.mediaUrl ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={metadata.mediaUrl}
            onTimeUpdate={handleNativeTimeUpdate}
            onLoadedMetadata={handleNativeLoadedMetadata}
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
                onTimeUpdate={handleNativeTimeUpdate}
                onLoadedMetadata={handleNativeLoadedMetadata}
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
              onClick={() => handleSeekRelative(-5)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Rewind 5 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play Video / Audio'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => handleSeekRelative(5)}
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
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Direct Open YouTube Link if applicable */}
            {isYouTube && metadata.mediaUrl && (
              <a
                href={metadata.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Open original video on YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
