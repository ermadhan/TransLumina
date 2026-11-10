/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Languages, Wand2, Download, FileAudio, Youtube, Sparkles } from 'lucide-react';

interface HeaderProps {
  onNewMedia: () => void;
  onOpenExport?: () => void;
  hasActiveTranscript: boolean;
  onLoadSample: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewMedia,
  onOpenExport,
  hasActiveTranscript,
  onLoadSample,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Languages className="w-5 h-5" />
          </div>
          <button
            onClick={onNewMedia}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap hover:text-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer text-left"
          >
            <span>TransLumina</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Studio
            </span>
          </button>
        </div>

        {/* Zone 2: 3-4 clean single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={onNewMedia}
            className="hover:text-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileAudio className="w-4 h-4 text-indigo-400" />
            <span>Workspace</span>
          </button>
          <button
            onClick={onLoadSample}
            className="hover:text-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Wand2 className="w-4 h-4 text-cyan-400" />
            <span>Preloaded Demo</span>
          </button>
          <button
            onClick={onNewMedia}
            className="hover:text-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Youtube className="w-4 h-4 text-rose-400" />
            <span>YouTube & Streaming</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {hasActiveTranscript ? (
            <button
              onClick={onOpenExport}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Subtitles</span>
            </button>
          ) : (
            <button
              onClick={onLoadSample}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Load Sample Media</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
