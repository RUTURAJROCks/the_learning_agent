// Configuration
const BACKEND_URL = 'http://localhost:3000'; // Change to Vercel URL in production

// UI Elements
const stepSetup = document.getElementById('step-setup');
const stepLoading = document.getElementById('step-loading');
const stepQuiz = document.getElementById('step-quiz');
const stepLearning = document.getElementById('step-learning');

const inputTopic = document.getElementById('input-topic');
const inputPrior = document.getElementById('input-prior');
const inputUrl = document.getElementById('input-url');

const btnGenerateQuiz = document.getElementById('btn-generate-quiz');
const btnNextQuestion = document.getElementById('btn-next-question');
const btnTogglePip = document.getElementById('btn-toggle-pip');
const btnRestart = document.getElementById('btn-restart');

const loadingText = document.getElementById('loading-text');
const quizProgress = document.getElementById('quiz-progress');
const quizQuestion = document.getElementById('quiz-question');
const quizOptions = document.getElementById('quiz-options');
const activityLog = document.getElementById('activity-log');

// State Variables
let currentTabId = null;
let currentVideoUrl = '';
let quizQuestions = [];
let currentQuestionIndex = 0;
let selectedOption = null;
let quizAnswers = []; // Stores user answers: { question: string, selected: string, isCorrect: boolean }

// Helper: Add log entry to the UI
function logActivity(message) {
  const time = new Date().toLocaleTimeString();
  activityLog.innerText = `[${time}] ${message}\n` + activityLog.innerText;
}

// 1. Detect Active YouTube Tab
async function detectYoutubeTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (activeTab && activeTab.url && activeTab.url.includes('youtube.com')) {
      currentTabId = activeTab.id;
      currentVideoUrl = activeTab.url;
      inputUrl.value = currentVideoUrl;
      btnGenerateQuiz.disabled = false;
      logActivity(`Detected YouTube page: ${activeTab.title}`);
    } else {
      inputUrl.value = 'Please open a YouTube video first.';
      btnGenerateQuiz.disabled = true;
      logActivity('Waiting for you to focus a YouTube tab.');
    }
  } catch (error) {
    console.error('Error detecting active tab:', error);
  }
}

// Listen for tab updates
chrome.tabs.onActivated.addListener(detectYoutubeTab);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    detectYoutubeTab();
  }
});

// Run detection on open
detectYoutubeTab();

// 2. Generate Quiz from Backend
btnGenerateQuiz.addEventListener('click', async () => {
  const topic = inputTopic.value.trim();
  const priorKnowledge = inputPrior.value.trim();

  if (!topic) {
    alert('Please enter what you are learning!');
    return;
  }

  // Switch to loading UI
  stepSetup.classList.add('hidden');
  stepLoading.classList.remove('hidden');
  loadingText.innerText = `Generating personalized quiz for "${topic}"...`;

  try {
    const response = await fetch(`${BACKEND_URL}/api/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, priorKnowledge })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    quizQuestions = data.questions;
    
    // Reset quiz state
    currentQuestionIndex = 0;
    quizAnswers = [];
    
    // Move to Quiz UI
    stepLoading.classList.add('hidden');
    stepQuiz.classList.remove('hidden');
    displayQuestion();

  } catch (error) {
    console.error('Failed to generate quiz:', error);
    alert('Failed to connect to backend. Please make sure the Next.js backend is running at: ' + BACKEND_URL);
    stepLoading.classList.add('hidden');
    stepSetup.classList.remove('hidden');
  }
});

// 3. Display Question in Side Panel
function displayQuestion() {
  const question = quizQuestions[currentQuestionIndex];
  quizProgress.innerText = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
  quizQuestion.innerText = question.text;
  quizOptions.innerHTML = '';
  selectedOption = null;
  btnNextQuestion.disabled = true;

  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.innerText = option;
    button.addEventListener('click', () => {
      // Select option UI update
      document.querySelectorAll('.option-btn').forEach((btn) => btn.classList.remove('selected'));
      button.classList.add('selected');
      selectedOption = option;
      btnNextQuestion.disabled = false;
    });
    quizOptions.appendChild(button);
  });
}

// 4. Handle Option Submission / Next Question
btnNextQuestion.addEventListener('click', () => {
  const currentQuestion = quizQuestions[currentQuestionIndex];
  const isCorrect = (selectedOption === currentQuestion.correctAnswer);

  quizAnswers.push({
    question: currentQuestion.text,
    selected: selectedOption,
    isCorrect: isCorrect
  });

  currentQuestionIndex++;

  if (currentQuestionIndex < quizQuestions.length) {
    displayQuestion();
  } else {
    finishOnboarding();
  }
});

// 5. Complete Onboarding and Start Session
async function finishOnboarding() {
  stepQuiz.classList.add('hidden');
  stepLoading.classList.remove('hidden');
  loadingText.innerText = 'Creating your knowledge profile...';

  const topic = inputTopic.value.trim();
  const priorKnowledge = inputPrior.value.trim();

  // Create list of topics/concepts the user knows (based on correct quiz answers)
  // and concepts they got wrong
  const knownConcepts = [];
  const unknownConcepts = [];

  quizAnswers.forEach((ans, idx) => {
    const concept = quizQuestions[idx].concept;
    if (concept) {
      if (ans.isCorrect) {
        knownConcepts.push(concept);
      } else {
        unknownConcepts.push(concept);
      }
    }
  });

  const profile = {
    topic,
    priorKnowledge,
    knownConcepts,
    unknownConcepts,
    quizResults: quizAnswers
  };

  // Save profile to chrome extension storage
  await chrome.storage.local.set({ learningProfile: profile, sessionActive: true });

  // Initialize caption monitoring in content script
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      action: 'START_SESSION',
      profile: profile
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Content script not loaded or ready:', chrome.runtime.lastError);
        logActivity('Error: Refresh the YouTube page to activate the overlay.');
      } else {
        logActivity('Learning overlay initialized on YouTube page.');
      }
    });
  }

  stepLoading.classList.add('hidden');
  stepLearning.classList.remove('hidden');
  logActivity(`Onboarding complete! Target topic: ${topic}.`);
  logActivity(`Detected ${knownConcepts.length} known concepts. Tracking live stream...`);
}

// 6. Floating Overlay (Always on top) Trigger
btnTogglePip.addEventListener('click', () => {
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'TOGGLE_PIP' });
    logActivity('Toggle always-on-top Picture-in-Picture window requested.');
  }
});

// 7. Restart / Reset Session
btnRestart.addEventListener('click', async () => {
  await chrome.storage.local.remove(['learningProfile', 'sessionActive']);
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'STOP_SESSION' });
  }
  stepLearning.classList.add('hidden');
  stepSetup.classList.remove('hidden');
  logActivity('Session reset.');
});

// Restore State on Startup
chrome.storage.local.get(['learningProfile', 'sessionActive'], (res) => {
  if (res.sessionActive && res.learningProfile) {
    stepSetup.classList.add('hidden');
    stepLearning.classList.remove('hidden');
    inputTopic.value = res.learningProfile.topic;
    inputPrior.value = res.learningProfile.priorKnowledge || '';
    logActivity(`Restored active session for "${res.learningProfile.topic}".`);
  }
});
