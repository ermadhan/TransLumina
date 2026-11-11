# TransLumina Studio — Windows Setup & Execution Guide

> Complete, step-by-step instructions to build, configure, and run **TransLumina Studio** on a Windows 10 or Windows 11 machine.

---

## 1. Prerequisites for Windows

Before starting, ensure your Windows machine has the following tools installed:

| Tool | Recommended Version | Verification Command | Download / Install |
| :--- | :--- | :--- | :--- |
| **Node.js** | **v20.x or v22.x LTS** (minimum v18+) | `node -v` | [nodejs.org](https://nodejs.org/) or `winget install OpenJS.NodeJS.LTS` |
| **npm** | **v10.x+** (bundled with Node) | `npm -v` | Included with Node.js |
| **Git** *(Optional)* | Latest | `git --version` | [git-scm.com](https://git-scm.com/) or `winget install Git.Git` |
| **Terminal** | **PowerShell** or **Windows Terminal** | — | Built-in on Windows 10/11 |

> **Tip**: You can install both Node.js LTS and Git in one command using Windows Package Manager (`winget`) in PowerShell:
> ```powershell
> winget install OpenJS.NodeJS.LTS Git.Git
> ```
> *Restart your terminal after installation so that `node` and `npm` are added to your system `PATH`.*

---

## 2. Gemini API Key Requirement

TransLumina Studio uses Google's `@google/genai` SDK to transcribe audio and translate dialogue. You will need a Gemini API Key:

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **"Get API key"** and create or select a Google Cloud project.
3. Copy your API key (it begins with `AIzaSy...`).

---

## 3. Step-by-Step Installation on Windows

### Step 1: Open Terminal in Project Directory
Navigate to the root folder of the project using **PowerShell** or **Command Prompt (cmd.exe)**:

```powershell
cd C:\path\to\your\translumina-applet
```

### Step 2: Install Dependencies
Run the standard package manager command:

```powershell
npm install
```

*(This will install React 19, Vite, Express, Tailwind CSS, `@google/genai`, Lucide icons, and TypeScript packages into `node_modules`.)*

### Step 3: Configure Your Environment Variable

You can provide your `GEMINI_API_KEY` using **any one** of the following three methods:

#### Method A: Create a `.env` File (Recommended for Local Dev)
In the root directory of the project, create a file named `.env` (or copy from `.env.example`):

```powershell
# In PowerShell:
Copy-Item .env.example .env
```

Open `.env` in Notepad or VS Code and replace `MY_GEMINI_API_KEY` with your actual key:
```env
GEMINI_API_KEY="AIzaSyYourActualKeyGoesHere"
APP_URL="http://localhost:3000"
```

#### Method B: Set in Current PowerShell Session
If you prefer not to store keys in a file, set the environment variable directly in your PowerShell session:

```powershell
$env:GEMINI_API_KEY="AIzaSyYourActualKeyGoesHere"
```

#### Method C: Set in Command Prompt (CMD)
If using the classic `cmd.exe`:

```cmd
set GEMINI_API_KEY=AIzaSyYourActualKeyGoesHere
```

#### Method D: Permanent Windows User Environment Variable (GUI)
1. Press `Win + R`, type `sysdm.cpl`, and hit `Enter`.
2. Go to the **Advanced** tab and click **Environment Variables**.
3. Under **User variables for <YourUser>**, click **New...**:
   - Variable name: `GEMINI_API_KEY`
   - Variable value: `AIzaSyYourActualKeyGoesHere`
4. Click **OK** to save and restart your terminal.

---

## 4. Running the Development Server

Start the local server running Express and Vite together on Windows. The server binds to `127.0.0.1` by default, so it is only reachable from the same machine:

```powershell
npm run dev
```

You should see output similar to:
```
  VITE v8.3.0  ready in 420 ms

  ➜  Local:   http://127.0.0.1:3000/

[TransLumina Server] Listening on http://127.0.0.1:3000
```

### Accessing the Studio
Open your browser (Chrome, Edge, Brave, or Firefox) and navigate to:
```
http://127.0.0.1:3000
```

Gemini-backed API routes have per-IP request limits. For trusted LAN access only, set `HOST` explicitly before starting the server, for example `$env:HOST="0.0.0.0"` in PowerShell. Do not expose this development server directly to the public internet; use an authenticated, rate-limited deployment setup instead.

---

## 5. Building for Production on Windows

To verify that the code compiles cleanly and create an optimized production build:

```powershell
# 1. Compile TypeScript & build static assets via Vite
npm run build

# 2. Run the production server
npm run start
```

The production server will listen on `http://localhost:3000` serving the compiled static bundle from the `/dist` directory.

---

## 6. Windows-Specific Troubleshooting

### Issue 1: PowerShell Script Execution Policy Error
**Symptom**: Running `npm` or `tsx` results in:
```
File C:\...\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```
**Fix**: Windows restricts PowerShell script execution by default. Open PowerShell and run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
*(Or permanently for your user account: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`)*.

---

### Issue 2: Port 3000 Already in Use (`EADDRINUSE: address already in use :::3000`)
**Symptom**: Starting the server crashes with:
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Fix**: Another application (or an orphaned Node process) is holding port 3000.

**Using PowerShell**:
```powershell
# Find and stop the process occupying port 3000:
$portProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portProcess) {
    Stop-Process -Id $portProcess.OwningProcess -Force
    Write-Host "Killed process on port 3000"
}
```

**Using Command Prompt (CMD)**:
```cmd
netstat -ano | findstr :3000
# Note the PID in the rightmost column (e.g., 8432), then run:
taskkill /PID 8432 /F
```

---

### Issue 3: Windows Defender Firewall Prompt
**Symptom**: When running `npm run dev` for the first time, a Windows Firewall alert appears: *"Windows Defender Firewall has blocked some features of Node.js: Server-side JavaScript"*.

**Fix**:
- Check **Private networks, such as my home or work network**.
- Click **Allow access**.
- (You do not need to enable public networks unless accessing from untrusted Wi-Fi).

---

### Issue 4: Windows Path Length Limitations (`MAX_PATH`)
**Symptom**: Errors during `npm install` mentioning file path length or `ENAMETOOLONG`.

**Fix**: Enable long path support in Windows via PowerShell (as Administrator):
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```
Or configure Git for long paths:
```powershell
git config --system core.longpaths true
```

---

### Issue 5: Audio Files Not Playing or Stuttering on Windows
TransLumina serves sample spoken dialogue (`sample-en.mp3` and `sample-es.mp3`) with HTTP `Accept-Ranges: bytes` support:
1. Ensure your browser allows auto-playing audio with sound or click the **Play** button directly.
2. Check that the files exist under `public/audio/sample-en.mp3`.
3. If testing in Edge or Chrome, open DevTools (`F12`), check the **Network** tab, and verify `/api/audio/sample-en.mp3` returns status `200` or `206 Partial Content`.

---

### Issue 6: YouTube Transcripts Differ from Spoken Speech
YouTube blocks third-party servers from downloading raw audio streams via bot-protection challenges (`LOGIN_REQUIRED`). When pasting a YouTube link:
- TransLumina renders the video in an embedded iFrame and generates a metadata-inferred transcript outline.
- **For 100% authentic acoustic transcription**: Download the audio or video file (`.mp3`, `.m4a`, or `.mp4`) to your Windows machine and drop it into the **File Upload** tab (supports files up to 40 MB). TransLumina will upload the raw audio directly to Gemini's multimodal audio encoder for verbatim phoneme-level speech recognition.

---

## 7. Verification Checklist

Run this quick command to verify your Windows setup:

```powershell
# Test server health endpoint (in PowerShell):
Invoke-RestMethod -Uri "http://localhost:3000/api/health"
```

Expected JSON response:
```json
{
  "status": "ok",
  "hasApiKey": true
}
```

If `hasApiKey` is `true`, your Windows environment is fully configured and ready to process audiovisual media!
