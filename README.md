# TransLumina Studio

> **Multilingual Media Translator & Synchronized Transcript Workstation**  
> Built with Google AI Studio, React 19, Express, Tailwind CSS, and the `@google/genai` SDK.

TransLumina Studio is an audiovisual transcription and translation suite. It transcribes spoken dialogue from streaming links (YouTube, YouTube Music, Spotify) and local audio/video file uploads, translates the speech into 50+ languages with millisecond-accurate subtitle timecodes, and exports production-ready subtitle files (**SRT**, **WebVTT**) and text documents (**Plain Text**, **Markdown**, **JSON**).

> **Running on Windows?** See the [Windows Setup & Execution Guide](README_WINDOWS.md) for PowerShell/CMD instructions, environment variable configuration, and Windows troubleshooting.

---

## Key Capabilities

- **Universal Media Ingestion**:
  - **Streaming URLs**: Supports YouTube videos, streaming URLs, and podcast links with automatic metadata extraction and thumbnail detection.
  - **Direct File Upload**: Drag-and-drop audio and video files (`.mp3`, `.wav`, `.mp4`, `.m4a`, `.webm`, `.ogg`, `.flac`) with in-browser preview.
  - **Preloaded Demos**: Verified sample recordings (e.g., Multimodal AI Keynote, Ocean Acoustics) with real synchronized spoken speech tracks.
- **AI Multimodal Transcription & Translation**:
  - Powered by Gemini (`gemini-3.8-flash`) using structured JSON schemas for granular sentence-level timestamps.
  - 50+ target languages with an instant **"Translate To"** selector to re-translate transcripts on the fly without re-processing media.
- **Synchronized Bilingual Media Player**:
  - Real-time sentence highlighting and auto-scrolling synced to playback.
  - Clickable timecode buttons (`00:12 → 00:18`) to immediately seek media playback to any spoken cue.
  - Multiple viewing modes: **Bilingual (Dual)**, **Translated Only**, or **Original Speech Only**.
  - Dual spoken voice tracks: listen to **Spoken Speech (Original English)** or **Translated Dub (Spanish)**.
- **Integrated In-Text Search Bar**:
  - Live query matching across both original speech and translated text.
  - In-text keyword highlighting (`<mark>`) in both languages.
  - Match counter (`1 of 4 matches`) with previous/next chevron navigation (`▲` / `▼`).
  - Filter toggle to switch between full transcript highlights and a filtered cue list.
- **In-Line Segment Editor**:
  - Click the pencil icon on any dialogue segment to adjust translated wording or original speech with live saving.
- **Complete Export Suite**:
  - **Timed Subtitles**: Industry-standard **SRT (`.srt`)** and **WebVTT (`.vtt`)** with millisecond timecodes.
  - **Formatted Documents**: Clean **Plain Text (`.txt`)** and structured **Markdown (`.md`)** with dialogue tables and executive summaries.
  - **Developer Data**: Structured **JSON (`.json`)** for downstream processing.
  - 1-click browser download or instant clipboard copy.

---

## How to Use via Google AI Studio

### 1. API Key & Authentication
In Google AI Studio, the application automatically accesses your Gemini API key from the environment:
- If prompted, select or configure your Gemini API Key in the **Settings > Secrets** panel in the AI Studio UI (`GEMINI_API_KEY`).
- No client-side key input is required; all Gemini calls run through server-side proxy routes (`/api/*`).

### 2. Loading or Uploading Media
1. Click **"Add Media Source"** (or use the top navigation):
   - **Media Link Tab**: Paste any YouTube video URL or streaming audio/video link. The studio automatically inspects the title and thumbnail.
   - **File Upload Tab**: Drag and drop an audio or video file from your computer (e.g. `.mp3`, `.wav`, `.mp4`, `.m4a`).
   - **Quick Samples Tab**: Click **"Try Demo Clip"** to immediately test with preloaded audio and bilingual transcripts.
2. Select your **Source Language** (or leave as `Auto-Detect`).
3. Select your desired **Target Language** (e.g., Spanish, French, German, Japanese, Chinese, Hindi, Arabic, etc.).
4. Click **"Translate & Transcribe"**.

### 3. Reviewing & Editing Synchronized Transcripts
- Click **Play** or press the **`Space`** bar to begin playback. The current spoken cue will illuminate with cyan/indigo accent lighting.
- Click any timecode button to seek the media player directly to that second.
- Press **`Ctrl + F`** (or **`Cmd + F`**) to jump directly into the search bar:
  - Type any keyword to highlight matches in real-time.
  - Press **`Enter`** to advance to the next match, **`Shift + Enter`** for the previous match, or **`Escape`** to clear.
- Click the **speaker icon (`🔊`)** on any transcript row to hear that specific line read aloud.
- Click the **edit icon (`✎`)** to tweak words in either the original or translated version.

### 4. Exporting Subtitles & Documents
1. Click **"Export Subtitles"** in the top bar.
2. Choose your export format:
   - **SRT (`.srt`)**: SubRip subtitle format with sequence numbers and millisecond timecodes (`00:01:23,450 --> 00:01:28,100`).
   - **WebVTT (`.vtt`)**: Web Video Text Tracks format for HTML5 players and online video platforms.
   - **Plain Text (`.txt`)**: Continuous dialogue text with optional timecodes.
   - **Markdown (`.md`)**: Formatted document with title, source metadata, summary, and dialogue tables.
   - **JSON (`.json`)**: Raw structured cue objects for software integrations.
3. Choose your language mode: **Bilingual (Dual-Language)**, **Translated Only**, or **Original Only**.
4. Click **"Download File"** or **"Copy Code"**.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Space`** | Play / Pause media playback & voice narration (when not typing in an input) |
| **`←` (Left Arrow)** | Seek backward 5 seconds |
| **`→` (Right Arrow)** | Seek forward 5 seconds |
| **`Ctrl + F` / `Cmd + F`** | Focus transcript search bar |
| **`Enter`** | Jump to next search match |
| **`Shift + Enter`** | Jump to previous search match |
| **`Escape`** | Clear search bar and match highlights |

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend**: Node.js, Express, tsx.
- **AI & SDK**: `@google/genai` (Server-side Gemini 3.8 Flash model with structured JSON schemas).
- **Development Server**: Port `3000` with Express and Vite middleware.
