# The Learning Agent 🧠🎥

The Learning Agent is an AI-powered, real-time learning companion that overlay-integrates directly with **YouTube Live streams** and regular videos. It captures auto-generated live captions, filters out technical terms you already know (via a diagnostic onboarding quiz), and displays unfamiliar concepts dynamically on top of your video player. 

It also supports an **Always-On-Top floating overlay** using the modern **Document Picture-in-Picture API** so you can keep the learning glossary visible while writing code in your editor.

---

## Repository Structure

*   `extension/`: The Chrome Extension (manifest.json, background script, content overlay script, onboarding sidepanel UI).
*   `backend/`: The Next.js API server (CORS-enabled API routes for quiz generation, text keyword extraction, and concept definitions using Gemini 2.0 Flash).

---

## How to Set Up & Run Locally

### 1. Configure the Gemini API Key
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Open `.env.local` and paste your Google Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
3. Install dependencies and start the local development server:
   ```bash
   npm install
   npm run dev
   ```
   This will run the backend APIs at `http://localhost:3000`.

### 2. Load the Chrome Extension
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `extension` folder inside this repository.

---

## How to Use
1. Open a YouTube video or a **YouTube Live stream** that has English captions enabled.
2. Click the extension icon in your Chrome toolbar to open the **Learning Side Panel**.
3. Type the topic you want to learn (e.g. `Rust Axum Web Server`) and click **Generate Diagnostic Quiz**.
4. Answer the 5 diagnostic questions to create your knowledge profile.
5. Click **Start Live Monitoring** to inject the overlay. Ensure CC (captions) is enabled on the YouTube player.
6. Click **Toggle Floating Overlay (Always-on-top)** to pop out the live learning list so it stays visible on top of other applications.
7. Click `-->` to see definitions with code examples, and `x` to clear terms you already know.
