/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Languages,
  Check,
  Copy,
  Edit2,
  Clock,
  Sparkles,
  ArrowUpDown,
  Volume2,
  FileText
} from 'lucide-react';
import { TranscriptSegment, SUPPORTED_LANGUAGES } from './types/transcript';
import { formatDisplayTime, copyToClipboard } from './utils/exportFormats';

interface BilingualTranscriptViewProps {
  segments: TranscriptSegment[];
  activeSegmentId: string | null;
  onSeek: (time: number) => void;
  onUpdateSegment: (updatedSegment: TranscriptSegment) => void;
  targetLanguage: string;
  sourceLanguage: string;
  onChangeTargetLanguage: (newLanguage: string) => Promise<void>;
  isRetranslating?: boolean;
}

export const BilingualTranscriptView: React.FC<BilingualTranscriptViewProps> = ({
  segments,
  activeSegmentId,
  onSeek,
  onUpdateSegment,
  targetLanguage,
  sourceLanguage,
  onChangeTargetLanguage,
  isRetranslating = false,
}) => {
  const [viewMode, setViewMode] = useState<'bilingual' | 'translated' | 'original'>('bilingual');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState('');
  const [editTranslated, setEditTranslated] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (autoScroll && activeSegmentRef.current && containerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSegmentId, autoScroll]);

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditOriginal(seg.originalText);
    setEditTranslated(seg.translatedText);
  };

  const handleSaveEdit = (seg: TranscriptSegment) => {
    onUpdateSegment({
      ...seg,
      originalText: editOriginal,
      translatedText: editTranslated,
    });
    setEditingSegmentId(null);
  };

  const handleCopySegment = async (seg: TranscriptSegment) => {
    const text =
      viewMode === 'bilingual'
        ? `${seg.translatedText}\n(${seg.originalText})`
        : viewMode === 'translated'
        ? seg.translatedText
        : seg.originalText;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(seg.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const filteredSegments = segments.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.originalText.toLowerCase().includes(q) ||
      s.translatedText.toLowerCase().includes(q) ||
      (s.speaker && s.speaker.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl flex flex-col h-full shadow-xl overflow-hidden">
      {/* Top Header & Workstation Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Synchronized Transcript</span>
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {segments.length} cues
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any timecode or phrase to seek playback directly.
            </p>
          </div>

          {/* Quick Target Language Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Translate To:</span>
            <div className="relative">
              <select
                value={targetLanguage}
                onChange={(e) => onChangeTargetLanguage(e.target.value)}
                disabled={isRetranslating}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs font-semibold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.name}>
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* View Mode Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* View Modes */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl self-start">
            <button
              onClick={() => setViewMode('bilingual')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'bilingual'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bilingual (Dual)
            </button>
            <button
              onClick={() => setViewMode('translated')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'translated'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {targetLanguage} Only
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                viewMode === 'original'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Original ({sourceLanguage})
            </button>
          </div>

          {/* Search Bar & Auto-Scroll Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                autoScroll
                  ? 'bg-slate-800 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle automatic scrolling with audio playback"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span className="hidden sm:inline">Auto-scroll</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Segments List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 max-h-[550px] divide-y divide-slate-800/40"
      >
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No dialogue cues found matching "{searchQuery}".
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isActive = segment.id === activeSegmentId;
            const isEditing = segment.id === editingSegmentId;

            return (
              <div
                key={segment.id}
                ref={isActive ? activeSegmentRef : null}
                className={`pt-3.5 transition-all rounded-xl p-3 sm:p-4 group ${
                  isActive
                    ? 'bg-indigo-950/40 border border-indigo-500/50 shadow-md shadow-indigo-950/50'
                    : 'hover:bg-slate-900/50 border border-transparent'
                }`}
              >
                {/* Segment Header: Timecode and Actions */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSeek(segment.start)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-800 text-indigo-300 hover:bg-indigo-900/60'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{formatDisplayTime(segment.start)}</span>
                      <span className="text-[10px] text-slate-400">→</span>
                      <span>{formatDisplayTime(segment.end)}</span>
                    </button>

                    {segment.speaker && (
                      <span className="text-xs font-medium text-slate-400">
                        {segment.speaker}
                      </span>
                    )}

                    {isActive && (
                      <span className="text-[11px] font-medium text-cyan-400 flex items-center gap-1 animate-pulse">
                        <Volume2 className="w-3 h-3" />
                        <span>Speaking</span>
                      </span>
                    )}
                  </div>

                  {/* Actions: Speak, Copy & Edit */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeek(segment.start);
                        const text = viewMode === 'translated' ? (segment.translatedText || segment.originalText) : segment.originalText;
                        const audio = new Audio(`/api/speak-cue?text=${encodeURIComponent(text)}&voice=Kore`);
                        audio.play().catch(() => {
                          if (typeof window !== 'undefined' && window.speechSynthesis) {
                            window.speechSynthesis.cancel();
                            const utterance = new SpeechSynthesisUtterance(text);
                            window.speechSynthesis.speak(utterance);
                          }
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Speak this line aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopySegment(segment)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Copy segment"
                    >
                      {copiedId === segment.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleStartEdit(segment)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Edit text"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Segment Content (View or Edit Mode) */}
                {isEditing ? (
                  <div className="space-y-3 mt-2 bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                        Translated ({targetLanguage})
                      </label>
                      <textarea
                        value={editTranslated}
                        onChange={(e) => setEditTranslated(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Original ({sourceLanguage})
                      </label>
                      <textarea
                        value={editOriginal}
                        onChange={(e) => setEditOriginal(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingSegmentId(null)}
                        className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(segment)}
                        className="px-3 py-1 rounded text-xs text-white bg-indigo-600 hover:bg-indigo-500 font-semibold cursor-pointer"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => onSeek(segment.start)}
                    className="cursor-pointer space-y-1.5"
                  >
                    {/* Translated Text (Shown in bilingual and translated mode) */}
                    {(viewMode === 'bilingual' || viewMode === 'translated') && (
                      <p className={`text-sm sm:text-base font-medium leading-relaxed ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}>
                        {segment.translatedText || segment.originalText}
                      </p>
                    )}

                    {/* Original Text (Shown in bilingual and original mode) */}
                    {(viewMode === 'bilingual' || viewMode === 'original') && (
                      <p className={`text-xs sm:text-sm leading-relaxed ${
                        viewMode === 'bilingual'
                          ? 'text-slate-400 font-normal italic'
                          : isActive ? 'text-white font-medium' : 'text-slate-200'
                      }`}>
                        {segment.originalText}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
