# Multilingual Audio & Video Translator & Transcript Studio

A high-performance media transcription and translation workstation that ingests audio/video from web links (YouTube, streaming media) and file uploads, translates spoken dialogue into 50+ languages with timestamp synchronization, and exports production-grade subtitle (SRT, VTT) and text documents (TXT, MD).

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the interactive clarification phase and form the baseline for implementation:

- **Confirmed Decision 1 (Media Input)**: Full support for both streaming web links (YouTube, media URLs) and direct audio/video file uploads (MP3, WAV, MP4, M4A, WebM, OGG), supplemented by built-in test samples for immediate zero-friction evaluation.
- **Confirmed Decision 2 (Export Formats)**: Downloadable export suite offering timed subtitle formats (**SRT** and **WebVTT**) as well as structured documentation (**Plain Text .txt** and formatted **Markdown .md**), with options to export bilingual or single-language versions.
- **Confirmed Decision 3 (Viewing Experience)**: Interactive dual-panel media workstation featuring synchronized bilingual captions, clickable timestamp navigation to seek media playback, live text search, and in-place segment editing.

---

### 1. Overview & Core Concept

- **What It Does**: Transcribes spoken audio from video and audio streams or uploaded media files, translates it into any target language with sentence-level timestamps, presents an interactive player that highlights spoken words in real time, and exports timed subtitle files or text transcripts.
- **Target Audience / Persona**: Content creators, translators, language learners, podcasters, international researchers, and media professionals who need fast, accurate subtitles and localized transcripts without manual transcription or timing.
- **Key Value**: Eliminates the tedious workflow of separate transcription, manual translation, and timestamp alignment by combining multimodal Gemini processing, synchronized playback, and instant multi-format downloads into a single unified web studio.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Source Selection & Media Ingestion**:
   - The user selects an input tab: **"Paste Media Link"** (YouTube URL, direct audio/video link) or **"Upload File"** (drag-and-drop MP3, WAV, MP4, M4A, WebM) or clicks one of the **Preloaded Samples** (e.g., Tech Keynote, Global News, Multilingual Dialogue).
   - The user selects the **Source Language** (or "Auto-Detect") and the **Target Language** (50+ languages with search filter).
2. **AI Multimodal Transcription & Translation**:
   - The user clicks **"Translate & Transcribe Media"**.
   - A step indicator visualizes the pipeline: Audio Extraction $\rightarrow$ Speech Recognition $\rightarrow$ Contextual Translation $\rightarrow$ Timestamp Alignment.
3. **Synchronized Playback & Inspection**:
   - The interactive media player loads the video/audio with full playback controls (play/pause, timeline scrubber, playback speed $0.5\times$ to $2.0\times$, volume).
   - Below or beside the player, the bilingual transcript scrolls dynamically: active segments illuminate with high visual clarity as spoken.
   - Clicking any sentence or timestamp seeks the media player directly to that second.
   - An integrated search bar highlights keywords across both original and translated text.
   - Users can edit segment text inline if minor tweaks are desired.
4. **Export & Download**:
   - The user clicks **"Export Transcript"** and selects their desired format:
     - **SRT (.srt)**: SubRip subtitle format with sequence numbers, timecodes (`00:01:23,450 --> 00:01:28,100`), and formatted text.
     - **WebVTT (.vtt)**: Web Video Text Tracks format compatible with HTML5 `<track>` and YouTube captions.
     - **Plain Text (.txt)**: Clean transcript with or without timestamps.
     - **Markdown (.md)**: Formatted document with media title, source URL, duration, language pair, and chronological dialogue.
   - One-click "Copy to Clipboard" for both original and translated versions.

#### Visual Identity & Theme
- **Aesthetic Direction**: Modern audio/video production suite—sleek, utilitarian, and focused. Dark canvas with rich slate surfaces and precision accent markers.
- **Color Palette & Mood**:
  - Neutral Canvas: Deep slate `#0B0F19` (60%) with crisp border dividers (`#1E293B`).
  - Structural Surfaces: Card & panel backgrounds `#111827` and `#1E293B` (30%).
  - Accents: High-visibility electric indigo `#6366F1` and cyan `#06B6D4` (10%) for active scrubbers, playheads, and active caption indicators.
  - Semantic Status: Emerald `#10B981` for completed processing, Amber `#F59E0B` for streaming/processing, Rose `#F43F5E` for errors.
- **Typography & Hierarchy**:
  - Display Font: `Plus Jakarta Sans` for clean, professional headers and navigation.
  - Body Prose: `Public Sans` / `DM Sans` for readable transcript text.
  - Timestamps & Metrics: Monospace `JetBrains Mono` with `tabular-nums` for rock-solid vertical alignment of timecodes (`01:24.50`).
- **Zero-Pill & Anti-Slop Discipline**:
  - Unboxed metadata using subtle dot separators (`English · Spanish · 03:45 · 48 Segments`).
  - No decorative status dots or fake AI innovation scores.
  - Clean top bar following the 3-zone contract (Brand wordmark, concise navigation links, primary action).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Gemini Multimodal Processing**:
  - *Chosen Approach*: Server-side API endpoint (`/api/process-media`) using `@google/genai` with `gemini-3.8-flash` structured JSON schema to generate paired source and translated segments with millisecond timestamps and chapter summaries.
  - *Why*: Ensures API keys remain completely secure on the backend, leverages Gemini's native audio comprehension and multilingual capabilities, and guarantees reliable structured JSON schemas for SRT/VTT generation.
- **Decision 2: Universal Media Engine (Files, Direct Audio, YouTube & Samples)**:
  - *Chosen Approach*: A hybrid media engine supporting native HTML5 video/audio playback for uploaded and direct streams, an embedded YouTube player API for YouTube links with synchronized seek controls, and pre-packaged sample files.
  - *Why*: Allows users to process any media source seamlessly while honoring browser sandbox limits and cross-origin security restrictions.
- **Decision 3: Real-Time Timestamp Sync Engine**:
  - *Chosen Approach*: `requestAnimationFrame` and `timeupdate` listeners syncing the active media playback position with the transcript segment array, using binary search for $O(\log n)$ active segment detection and smooth auto-scrolling.
  - *Why*: Delivers an ultra-responsive, lag-free karaoke-style highlight experience without jittering or layout shifts.
- **Decision 4: Multi-Format Subtitle & Document Exporter**:
  - *Chosen Approach*: Client-side generative formatting engines that construct valid `.srt`, `.vtt`, `.txt`, and `.md` file blobs directly in memory with UTF-8 encoding and instant browser download triggers.
  - *Why*: Instant downloads with zero server roundtrip latency, full privacy, and offline export capability.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (React 19)                         │
│                                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────────────────────┐  │
│  │   Media Input Panel   │  │           Interactive Workstation          │  │
│  │ • Link Input (YouTube)│  │ ┌──────────────────┐  ┌──────────────────┐ │  │
│  │ • File Dropzone       │  │ │  Media Player    │  │ Bilingual Sync   │ │  │
│  │ • Sample Selector     │  │ │ (Audio/Video/YT) │  │ Transcript View  │ │  │
│  │ • Language Picker     │  │ └────────┬─────────┘  └────────▲─────────┘ │  │
│  └───────────┬───────────┘  └──────────┼─────────────────────┼───────────┘  │
│              │                         │ seekTo(time)        │ activeId     │
│              ▼                         ▼                     │              │
│  ┌───────────────────────┐  ┌────────────────────────────────┴───────────┐  │
│  │ Export & Action Bar   │  │          Playback Synchronization Engine   │  │
│  │ [SRT] [VTT] [TXT] [MD]│  │     (timeupdate, smooth scroll, search)    │  │
│  └───────────────────────┘  └────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/process-media
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVER LAYER (Node / Express)                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ /api/process-media                                                    │  │
│  │ • Validates payload (base64 audio chunk / media metadata / URL)       │  │
│  │ • GoogleGenAI client (User-Agent: aistudio-build)                     │  │
│  │ • Calls gemini-3.8-flash with structured JSON responseSchema         │  │
│  │ • Returns synchronized Segment[] + metadata + summary                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Data Model & Entities

```typescript
export interface TranscriptSegment {
  id: string;
  start: number;       // in seconds, e.g. 12.45
  end: number;         // in seconds, e.g. 17.80
  originalText: string;
  translatedText: string;
  speaker?: string;
}

export interface MediaProject {
  id: string;
  title: string;
  sourceType: 'file' | 'url' | 'sample';
  mediaUrl?: string;
  mediaType: 'audio' | 'video';
  sourceLanguage: string;
  targetLanguage: string;
  duration: number;
  segments: TranscriptSegment[];
  summary?: string;
  keyTopics?: string[];
  createdAt: string;
}
```

#### Export Specifications
- **SRT Engine**: Converts `start` and `end` seconds into `HH:MM:SS,mmm` format with 1-based indexing.
- **WebVTT Engine**: Emits standard `WEBVTT` headers with `HH:MM:SS.mmm` cue timings.
- **Plain Text Engine**: Formats continuous prose or timestamped speaker lines.
- **Markdown Engine**: Generates a structured document with YAML frontmatter, summary, and tabular/block-quoted dialogue.
