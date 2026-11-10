/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Globe, Clock, Layers, BookOpen } from 'lucide-react';
import { MediaMetadata } from './types/transcript';
import { formatDisplayTime } from './utils/exportFormats';

interface SummaryCardProps {
  metadata: MediaMetadata;
  segmentCount: number;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  metadata,
  segmentCount,
}) => {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Title & Metadata row */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-cyan-400 font-semibold">{metadata.mediaType.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>{metadata.sourceLanguage} → {metadata.targetLanguage}</span>
          {metadata.duration ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatDisplayTime(metadata.duration)}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{segmentCount} dialogue cues</span>
          <span aria-hidden="true">·</span>
          {metadata.sourceType === 'sample' ? (
            <span className="text-cyan-400 font-mono text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Studio Demo
            </span>
          ) : metadata.transcriptType === 'web-grounded' ? (
            <span className="text-amber-300 font-mono text-[11px] flex items-center gap-1" title="Derived from verified web context because streaming platform restricts raw audio downloading. Upload media file for 100% acoustic waveform transcription.">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Web-Grounded Dialogue
            </span>
          ) : (
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1" title="Transcribed directly from authentic binary acoustic waveforms">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Acoustic Waveform
            </span>
          )}
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1">
          {metadata.title}
        </h2>
        {metadata.author && (
          <p className="text-xs text-slate-400 mt-0.5">By {metadata.author}</p>
        )}
      </div>

      {/* Summary Paragraph */}
      {metadata.summary && (
        <div className="p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Executive Summary</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {metadata.summary}
          </p>
        </div>
      )}

      {/* Key Topics (Rendered without pill boxes per anti-slop guidelines) */}
      {metadata.keyTopics && metadata.keyTopics.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Key Topics
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {metadata.keyTopics.map((topic, i) => (
              <React.Fragment key={topic}>
                <span className="hover:text-indigo-300 transition-colors">{topic}</span>
                {i < metadata.keyTopics!.length - 1 && (
                  <span className="text-slate-600" aria-hidden="true">·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
