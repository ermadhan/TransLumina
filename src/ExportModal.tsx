/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Subtitles,
  FileType,
  Sparkles
} from 'lucide-react';
import {
  TranscriptSegment,
  MediaMetadata,
  ExportFormat,
  ExportLanguageMode
} from './types/transcript';
import {
  generateSRT,
  generateVTT,
  generateTXT,
  generateMarkdown,
  generateJSON,
  downloadFile,
  copyToClipboard
} from './utils/exportFormats';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  metadata: MediaMetadata;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  metadata,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('srt');
  const [languageMode, setLanguageMode] = useState<ExportLanguageMode>('bilingual');
  const [withTimestampsInTxt, setWithTimestampsInTxt] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Generate the formatted output string based on active options
  const formattedOutput = useMemo(() => {
    switch (selectedFormat) {
      case 'srt':
        return generateSRT(segments, languageMode);
      case 'vtt':
        return generateVTT(segments, languageMode);
      case 'txt':
        return generateTXT(segments, languageMode, withTimestampsInTxt);
      case 'md':
        return generateMarkdown(segments, languageMode, metadata);
      case 'json':
        return generateJSON(segments, metadata);
      default:
        return '';
    }
  }, [segments, metadata, selectedFormat, languageMode, withTimestampsInTxt]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const cleanTitle = (metadata.title || 'transcript')
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '_')
      .slice(0, 30);
    const suffix = languageMode === 'bilingual' ? 'bilingual' : languageMode;
    const filename = `${cleanTitle}_${suffix}.${selectedFormat}`;

    const mimeTypes: Record<ExportFormat, string> = {
      srt: 'text/plain',
      vtt: 'text/vtt',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
    };

    downloadFile(formattedOutput, filename, mimeTypes[selectedFormat]);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(formattedOutput);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Export Subtitles & Transcripts
              </h3>
              <p className="text-xs text-slate-400">
                Choose format, language mode, and download your production file.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Format Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              1. Choose Export Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: 'srt', label: 'SRT Subtitles', ext: '.srt', desc: 'Standard SubRip' },
                { id: 'vtt', label: 'WebVTT', ext: '.vtt', desc: 'HTML5 & Web' },
                { id: 'txt', label: 'Plain Text', ext: '.txt', desc: 'Clean Dialogue' },
                { id: 'md', label: 'Markdown', ext: '.md', desc: 'Formatted Docs' },
                { id: 'json', label: 'JSON Data', ext: '.json', desc: 'Dev Payload' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id as ExportFormat)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedFormat === fmt.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold text-white flex items-center justify-between">
                    <span>{fmt.label}</span>
                    <span className="text-[10px] font-mono text-indigo-400">{fmt.ext}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language Mode & Formatting Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                2. Subtitle Language Mode
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setLanguageMode('bilingual')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-center ${
                    languageMode === 'bilingual'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bilingual (Dual)
                </button>
                <button
                  onClick={() => setLanguageMode('translated')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-center ${
                    languageMode === 'translated'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Translated Only
                </button>
                <button
                  onClick={() => setLanguageMode('original')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-center ${
                    languageMode === 'original'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Original Only
                </button>
              </div>
            </div>

            {selectedFormat === 'txt' && (
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-slate-900/60">
                  <input
                    type="checkbox"
                    checked={withTimestampsInTxt}
                    onChange={(e) => setWithTimestampsInTxt(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Include `[00:00 - 00:05]` timestamps in plain text</span>
                </label>
              </div>
            )}
          </div>

          {/* Live Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Live Output Preview ({selectedFormat.toUpperCase()})
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {formattedOutput.split('\n').length} lines
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-56 overflow-y-auto leading-relaxed select-all">
              <pre className="whitespace-pre-wrap">{formattedOutput}</pre>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span>Ready for VLC, Premiere, YouTube, DaVinci Resolve & Web.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download .{selectedFormat} File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
