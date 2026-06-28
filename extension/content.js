// Configuration
const BACKEND_URL = 'https://the-learning-agent-rajas-projects-90b54f35.vercel.app';

// State variables
let activeProfile = null;
let sessionActive = false;
let processedTexts = new Set();
let textBuffer = '';
let bufferTimer = null;
let lastApiCallTime = 0;
const API_CALL_COOLDOWN = 10000; // 10 seconds cooldown between keyword extractions
let overlayStylesText = ''; // Stores overlay.css content for PiP window

// Fetch overlay CSS from extension bundle for PiP window style injection
fetch(chrome.runtime.getURL('overlay.css'))
  .then(res => res.text())
  .then(text => {
    overlayStylesText = text;
  })
  .catch(err => console.error('The Learning Agent: Failed to fetch overlay.css:', err));

// UI Elements
let overlayContainer = null;
let listContainer = null;
let pipWindow = null;

// Initialize when extension loads or starts session
chrome.storage.local.get(['learningProfile', 'sessionActive'], (res) => {
  if (res.sessionActive && res.learningProfile) {
    startLearningSession(res.learningProfile);
  }
});

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SESSION') {
    startLearningSession(request.profile);
    sendResponse({ status: 'ok' });
  } else if (request.action === 'STOP_SESSION') {
    stopLearningSession();
    sendResponse({ status: 'ok' });
  } else if (request.action === 'TOGGLE_PIP') {
    togglePipWindow();
    sendResponse({ status: 'ok' });
  }
  return true;
});

// 1. Initialize Learning Session
function startLearningSession(profile) {
  activeProfile = profile;
  sessionActive = true;
  console.log('The Learning Agent: Session started for topic:', profile.topic);
  
  createUIOverlay();
  setupCaptionObserver();
}

// 2. Tear Down Session
function stopLearningSession() {
  sessionActive = false;
  activeProfile = null;
  removeUIOverlay();
  if (captionObserver) {
    captionObserver.disconnect();
    captionObserver = null;
  }
  if (pipWindow) {
    pipWindow.close();
    pipWindow = null;
  }
  console.log('The Learning Agent: Session stopped.');
}

// 3. Create Custom Floating UI Overlay
function createUIOverlay() {
  removeUIOverlay(); // Clear any existing

  const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  if (!playerContainer) {
    console.error('The Learning Agent: YouTube player container not found.');
    return;
  }

  // Root Overlay Injected inside Player Container (so full-screen works)
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'tla-overlay-root';
  overlayContainer.className = 'tla-reset';

  overlayContainer.innerHTML = `
    <div class="tla-card">
      <div class="tla-header">
        <span class="tla-title">live Learning List</span>
        <div class="tla-controls">
          <button id="tla-btn-pip-icon" title="Float window">🗖</button>
          <button id="tla-btn-close-overlay" title="Hide overlay">×</button>
        </div>
      </div>
      <div class="tla-content" id="tla-keywords-list">
        <div class="tla-empty-state">Listening to captions... New concepts will appear here.</div>
      </div>
    </div>
  `;

  playerContainer.appendChild(overlayContainer);

  // Setup UI Event Listeners
  document.getElementById('tla-btn-pip-icon').addEventListener('click', togglePipWindow);
  document.getElementById('tla-btn-close-overlay').addEventListener('click', () => {
    overlayContainer.classList.add('tla-hidden');
  });

  listContainer = document.getElementById('tla-keywords-list');
  
  // Rehydrate existing keywords from storage if any
  chrome.storage.local.get(['sessionKeywords'], (res) => {
    if (res.sessionKeywords && res.sessionKeywords.length > 0) {
      listContainer.innerHTML = '';
      res.sessionKeywords.forEach(kw => appendKeywordToUI(kw));
    }
  });
}

function removeUIOverlay() {
  const existing = document.getElementById('tla-overlay-root');
  if (existing) existing.remove();
  overlayContainer = null;
  listContainer = null;
}

// 4. Observe captions from YouTube player
let playerObserver = null;
let captionObserver = null;
let lastCaptionText = '';

function setupCaptionObserver() {
  if (playerObserver) playerObserver.disconnect();
  if (captionObserver) captionObserver.disconnect();

  const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  if (!playerContainer) {
    // Retry finding video player container if not immediately found
    setTimeout(setupCaptionObserver, 2000);
    return;
  }

  console.log('The Learning Agent: Subtitle observer system initialized.');

  // Helper to attach observer directly to the caption window
  function attachToCaptionContainer(container) {
    if (captionObserver) captionObserver.disconnect();
    
    console.log('The Learning Agent: Subtitle window detected. Observing subtitle changes...');
    
    captionObserver = new MutationObserver(() => {
      if (!sessionActive) return;
      
      const currentText = container.textContent.trim().replace(/\s+/g, ' ');
      if (!currentText) return;

      if (currentText !== lastCaptionText) {
        let newText = '';
        if (currentText.startsWith(lastCaptionText)) {
          // Extract only the new words appended to the current card
          newText = currentText.substring(lastCaptionText.length).trim();
        } else {
          // Capture the whole text for a new card
          newText = currentText;
        }

        if (newText) {
          console.log('The Learning Agent: Captured text ->', newText);
          handleNewTextSegment(newText);
        }
        lastCaptionText = currentText;
      }
    });

    captionObserver.observe(container, { childList: true, characterData: true, subtree: true });
  }

  // 1. Check if the caption window is already loaded
  const existingContainer = document.querySelector('.ytp-caption-window-container');
  if (existingContainer) {
    attachToCaptionContainer(existingContainer);
  }

  // 2. Observe direct child additions of the player (lightweight) to see when subtitles are toggled on/off
  playerObserver = new MutationObserver(() => {
    if (!sessionActive) return;
    
    const container = document.querySelector('.ytp-caption-window-container');
    if (container) {
      attachToCaptionContainer(container);
    }
  });

  playerObserver.observe(playerContainer, { childList: true, subtree: false });
}

// 5. Buffer Live Transcript & Throttled Backend API Processing
function handleNewTextSegment(text) {
  textBuffer += ' ' + text;
  
  // Reset buffer timer (debounce)
  if (bufferTimer) clearTimeout(bufferTimer);
  
  // If buffer is getting large, or after 3 seconds of no new speech, process it
  const wordCount = textBuffer.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 30) {
    processTextBuffer();
  } else {
    bufferTimer = setTimeout(processTextBuffer, 3000);
  }
}

async function processTextBuffer() {
  if (!sessionActive || !textBuffer.trim()) return;

  const now = Date.now();
  if (now - lastApiCallTime < API_CALL_COOLDOWN) {
    // Too fast, delay execution slightly
    if (bufferTimer) clearTimeout(bufferTimer);
    bufferTimer = setTimeout(processTextBuffer, API_CALL_COOLDOWN - (now - lastApiCallTime));
    return;
  }

  const queryText = textBuffer.trim();
  textBuffer = ''; // Reset buffer
  lastApiCallTime = now;

  console.log('The Learning Agent: Processing transcript segment:', queryText);

  try {
    const response = await fetch(`${BACKEND_URL}/api/process-live-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: queryText,
        profile: activeProfile
      })
    });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    
    const data = await response.json();
    if (data.keywords && data.keywords.length > 0) {
      data.keywords.forEach(keyword => {
        addKeyword(keyword);
      });
    }
  } catch (error) {
    console.error('The Learning Agent: Failed to process live text:', error);
  }
}

// 6. Manage In-Memory Keywords and Local Storage
function addKeyword(keyword) {
  chrome.storage.local.get(['sessionKeywords'], (res) => {
    let keywords = res.sessionKeywords || [];
    
    // Check if keyword already exists (avoid duplicates)
    if (keywords.some(k => k.term.toLowerCase() === keyword.term.toLowerCase())) {
      return;
    }
    
    keywords.push(keyword);
    chrome.storage.local.set({ sessionKeywords: keywords });
    
    // UI updates
    if (keywords.length === 1 && listContainer) {
      listContainer.innerHTML = ''; // Clear empty state
    }
    
    appendKeywordToUI(keyword);
  });
}

function removeKeyword(term) {
  chrome.storage.local.get(['sessionKeywords', 'learningProfile'], (res) => {
    let keywords = res.sessionKeywords || [];
    keywords = keywords.filter(k => k.term.toLowerCase() !== term.toLowerCase());
    chrome.storage.local.set({ sessionKeywords: keywords });

    // Also append to "knownConcepts" in the active profile so it doesn't appear again
    if (res.learningProfile) {
      const profile = res.learningProfile;
      if (!profile.knownConcepts.includes(term)) {
        profile.knownConcepts.push(term);
        chrome.storage.local.set({ learningProfile: profile });
        activeProfile = profile;
      }
    }

    if (keywords.length === 0 && listContainer) {
      listContainer.innerHTML = '<div class="tla-empty-state">Listening to captions... New concepts will appear here.</div>';
    }
  });
}

// 7. Render Keyword Item inside Floating Overlay
function appendKeywordToUI(keyword) {
  if (!listContainer) return;

  const sanitizedTerm = keyword.term.replace(/\s+/g, '-').toLowerCase();
  const cardId = `tla-card-${sanitizedTerm}`;
  
  // Prevent duplicate insertion
  if (document.getElementById(cardId)) return;

  const card = document.createElement('div');
  card.className = 'tla-keyword-card';
  card.id = cardId;

  // Render the expanded contents directly since they are already pre-generated in the batch response!
  card.innerHTML = `
    <div class="tla-keyword-row">
      <span class="tla-keyword-name">${keyword.term}</span>
      <div class="tla-keyword-actions">
        <button class="tla-btn-explain" data-term="${keyword.term}">--></button>
        <button class="tla-btn-remove" data-term="${keyword.term}">×</button>
      </div>
    </div>
    <div class="tla-keyword-explanation tla-collapsed">
      <div class="tla-explanation-text">
        <p>${keyword.explanation || keyword.shortDescription}</p>
        ${keyword.example ? `<div class="tla-example"><strong>Example:</strong><pre><code>${keyword.example}</code></pre></div>` : ''}
      </div>
    </div>
  `;

  listContainer.appendChild(card);

  const btnExplain = card.querySelector('.tla-btn-explain');
  const explanationEl = card.querySelector('.tla-keyword-explanation');

  // Cross Option: Remove item
  card.querySelector('.tla-btn-remove').addEventListener('click', (e) => {
    const term = e.target.getAttribute('data-term');
    card.remove();
    removeKeyword(term);
  });

  // Arrow option: Toggle explanation (instant since pre-generated)
  btnExplain.addEventListener('click', () => {
    if (explanationEl.classList.contains('tla-collapsed')) {
      explanationEl.classList.remove('tla-collapsed');
      btnExplain.innerText = '<--';
    } else {
      explanationEl.classList.add('tla-collapsed');
      btnExplain.innerText = '-->';
    }
  });

  // Scroll to bottom of list
  listContainer.scrollTop = listContainer.scrollHeight;
}

// 8. Document Picture-in-Picture logic
async function togglePipWindow() {
  if (!('documentPictureInPicture' in window)) {
    alert('Document Picture-in-Picture is not supported in this browser. Please use a modern version of Chrome/Edge.');
    return;
  }

  // If already in PiP, close it
  if (pipWindow) {
    pipWindow.close();
    return;
  }

  const cardElement = overlayContainer.querySelector('.tla-card');
  if (!cardElement) return;

  try {
    // Open PiP window
    pipWindow = await documentPictureInPicture.requestWindow({
      width: 340,
      height: 480
    });

    // Copy styles from main document to PiP document
    const styleLink = document.createElement('style');
    styleLink.textContent = overlayStylesText;
    pipWindow.document.head.appendChild(styleLink);

    // Copy Font Stylesheet Link
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap';
    pipWindow.document.head.appendChild(fontLink);

    // Apply basic body styling in PiP window
    pipWindow.document.body.style.margin = '0';
    pipWindow.document.body.style.backgroundColor = '#09090b';
    pipWindow.document.body.style.color = '#f4f4f5';
    pipWindow.document.body.style.fontFamily = "'Outfit', sans-serif";
    pipWindow.document.body.style.overflow = 'auto'; // Let the floating window scroll if explanation is expanded

    // Move UI Card into PiP window
    pipWindow.document.body.appendChild(cardElement);
    overlayContainer.classList.add('tla-in-pip');

    // Update list container reference
    listContainer = pipWindow.document.getElementById('tla-keywords-list');

    // Handle closure of PiP window
    pipWindow.addEventListener('unload', (event) => {
      pipWindow = null;
      overlayContainer.classList.remove('tla-in-pip');
      
      // Move UI card back into main window overlay container
      const card = event.target.body.querySelector('.tla-card');
      if (card) {
        overlayContainer.appendChild(card);
      }
      
      // Restore main window list container reference
      listContainer = document.getElementById('tla-keywords-list');
      
      // Rebind controls
      document.getElementById('tla-btn-pip-icon').addEventListener('click', togglePipWindow);
      document.getElementById('tla-btn-close-overlay').addEventListener('click', () => {
        overlayContainer.classList.add('tla-hidden');
      });
    });

  } catch (error) {
    console.error('The Learning Agent: Error opening PiP window:', error);
  }
}
