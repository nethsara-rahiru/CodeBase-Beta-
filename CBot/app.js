import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ──────────────────────────────────────────
//  FIREBASE CONFIGURATION
// ──────────────────────────────────────────
// TODO: Replace this with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB-UK8Fa0FN2bt4tfQMl6ksWFwktqB8htU",
  authDomain: "codebase-83525.firebaseapp.com",
  databaseURL: "https://codebase-83525-default-rtdb.firebaseio.com",
  projectId: "codebase-83525",
  storageBucket: "codebase-83525.firebasestorage.app",
  messagingSenderId: "729735531784",
  appId: "1:729735531784:web:c6eba0c9a92ef6fff270bd",
  measurementId: "G-DTPQ1PHCBN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ──────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────
let GROQ_API_KEY = null;
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ──────────────────────────────────────────
//  OS & C TOPICS
// ──────────────────────────────────────────
const TOPICS = [
  "Basic Syntax",
  "Process Creation (fork)",
  "Process Trees",
  "Pipes",
  "Message Queues",
  "Shared Memory",
  "Signals",
  "Threads (pthread)",
];

// ──────────────────────────────────────────
//  KNOWLEDGE STATE
//  Per topic: level, attempts, scores[], skips, needsPractice, consecutiveGood, consecutiveBad
// ──────────────────────────────────────────
const knowledge = {};
TOPICS.forEach(t => {
  knowledge[t] = {
    level: "beginner",
    attempts: 0,
    skips: 0,
    scores: [],
    needsPractice: false,
    consecutiveGood: 0,
    consecutiveBad: 0,
  };
});

// ──────────────────────────────────────────
//  SESSION STATE
// ──────────────────────────────────────────
let currentQuestion = null;
let currentTopic = null;
let totalScore = 0;
let questionCount = 0;
let practiceRound = 0;   // cycles through needsPractice topics
let isSubmitting = false;

// ──────────────────────────────────────────
//  DOM REFS
// ──────────────────────────────────────────
const elQGen = document.getElementById("q-generating");
const elQGenMsg = document.getElementById("q-gen-msg");
const elQContent = document.getElementById("q-content");
const elDifficulty = document.getElementById("difficulty-tag");
const elConcept = document.getElementById("concept-tag");
const elTitle = document.getElementById("q-title");
const elBody = document.getElementById("q-body");
const elHintBox = document.getElementById("hint-box");
const elHintText = document.getElementById("hint-text");
const elBtnHint = document.getElementById("btn-hint");
const elBtnSubmit = document.getElementById("btn-submit");
const elBtnSkip = document.getElementById("btn-skip");
const elBtnNext = document.getElementById("btn-next");
const elFeedback = document.getElementById("feedback-panel");
const elFeedVerdict = document.getElementById("feedback-verdict");
const elFeedBody = document.getElementById("feedback-body");
const elFeedScore = document.getElementById("score-badge");
const elLoading = document.getElementById("loading-panel");
const elChipTopic = document.getElementById("chip-topic");
const elChipLevel = document.getElementById("chip-level");
const elChipScore = document.getElementById("chip-score");
const elChipCount = document.getElementById("chip-count");
const elGlobalProg = document.getElementById("global-progress");
const elBtnClear = document.getElementById("btn-clear");
const elBtnCopy = document.getElementById("btn-copy");
const elKpBody = document.getElementById("kp-body");
const elKpToggle = document.getElementById("kp-toggle");

// ──────────────────────────────────────────
//  CODEMIRROR EDITOR
// ──────────────────────────────────────────
const cmEditor = CodeMirror(document.getElementById("code-editor-container"), {
  value: "",
  mode: "text/x-csrc",
  theme: "dracula",
  lineNumbers: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  smartIndent: true,
  lineWrapping: false,
  extraKeys: {
    Tab: cm => {
      if (cm.somethingSelected()) {
        cm.indentSelection("add");
      } else {
        cm.replaceSelection("    ", "end");
      }
    },
    "Shift-Tab": cm => cm.indentSelection("subtract"),
    "Ctrl-/": cm => cm.execCommand("toggleComment"),
    "Cmd-/": cm => cm.execCommand("toggleComment"),
    "Ctrl-Space": cm => cm.showHint({ hint: cHint, completeSingle: false }),
  },
});

// ──────────────────────────────────────────
//  C AUTOCOMPLETE  (identifiers only)
// ──────────────────────────────────────────

// Pure language keywords to EXCLUDE from suggestions
const C_LANG_KEYWORDS = new Set([
  "auto", "break", "case", "char", "const", "continue", "default", "do",
  "double", "else", "enum", "extern", "float", "for", "goto", "if",
  "int", "long", "register", "return", "short", "signed", "sizeof", "static",
  "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while",
  "fork", "pipe", "pthread_create", "printf", "scanf", "malloc", "free"
]);

function cHint(cm) {
  const cursor = cm.getCursor();
  const token = cm.getTokenAt(cursor);
  const word = token.string;

  if (!word || word.length < 2) return null;

  // Get every word already in the editor, then filter to identifiers only
  const anyResult = CodeMirror.hint.anyword(cm);
  if (!anyResult || !anyResult.list.length) return null;

  const matches = anyResult.list.filter(w =>
    w !== word &&                   // not the word itself
    !C_LANG_KEYWORDS.has(w) &&  // not a language keyword
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(w)  // valid identifier shape
  );

  if (!matches.length) return null;

  return {
    list: matches,
    from: CodeMirror.Pos(cursor.line, token.start),
    to: CodeMirror.Pos(cursor.line, cursor.ch),
  };
}

// Auto-trigger on every letter keystroke (debounced 300ms)
let _hintTimer = null;
cmEditor.on("keyup", (cm, e) => {
  if (cm.state.completionActive) return;
  if (e.key.length !== 1) return;
  if (!/[a-zA-Z_$]/.test(e.key)) return;
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(() => {
    cm.showHint({ hint: cHint, completeSingle: false });
  }, 300);
});


// ──────────────────────────────────────────
//  TOPIC SELECTION (Adaptive)
// ──────────────────────────────────────────
function selectNextTopic() {
  // 1) Prioritise topics marked needsPractice (round-robin)
  const needsPractice = TOPICS.filter(t => knowledge[t].needsPractice);
  if (needsPractice.length > 0) {
    // Sort by (skips desc, avgScore asc) → worst topic first
    needsPractice.sort((a, b) => {
      const aSkips = knowledge[a].skips;
      const bSkips = knowledge[b].skips;
      if (bSkips !== aSkips) return bSkips - aSkips;
      const avgA = avgScore(a);
      const avgB = avgScore(b);
      return avgA - avgB;
    });
    return needsPractice[practiceRound % needsPractice.length];
  }

  // 2) Otherwise pick the topic with fewest attempts
  return TOPICS.slice().sort(
    (a, b) => knowledge[a].attempts - knowledge[b].attempts
  )[0];
}

function avgScore(topic) {
  const s = knowledge[topic].scores;
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
}

// ──────────────────────────────────────────
//  GENERATE QUESTION VIA AI
// ──────────────────────────────────────────
async function generateQuestion(topic, level) {
  const k = knowledge[topic];
  const contextParts = [];

  if (k.skips > 0)
    contextParts.push(`Student has skipped this topic ${k.skips} time(s) — they struggle with it`);
  if (k.scores.length > 0)
    contextParts.push(`Average score on this topic so far: ${avgScore(topic).toFixed(1)}/10`);
  if (k.needsPractice)
    contextParts.push("This is a practice question — the student needs more work here");

  const contextStr = contextParts.length
    ? contextParts.join(". ") + "."
    : "First attempt on this topic.";

  const levelGuide = {
    beginner: "Focus on a single basic OS/C concept. Simple function or system call usage, minimal code required.",
    intermediate: "Combine 2-3 C and OS concepts. Moderate complexity, handling system calls with basic error checking.",
    advanced: "Require solid OS understanding. Process trees, IPC synchronization, or complex memory management.",
  }[level];

  const systemPrompt = `You are an expert C programming and Operating Systems instructor generating coding exercises for a learning platform.
You MUST return a single valid JSON object and absolutely nothing else — no markdown, no explanation, no code fences.`;

  const userPrompt = `Generate a ${level}-level C Operating Systems coding exercise for the topic: "${topic}".

Student context: ${contextStr}
Difficulty guide: ${levelGuide}

Return this exact JSON structure:
{
  "title": "Short descriptive title (max 8 words)",
  "body": "HTML task description using <p>, <ul>, <li>, <code>, <pre> tags. Be specific about what to implement.",
  "hint": "One concise helpful hint as plain text (1-2 sentences).",
  "starter": "C starter code as a single JSON string. Use \\n for every line break and \\t for indentation. Must include #include directives and int main()."
}

Rules:
- starter MUST use \\n for newlines and \\t for indentation — do NOT embed actual newlines
- starter code MUST include the necessary #include directives and the main function where relevant
- body should list exactly what logic or system calls to implement
- Do NOT include a sample solution in the starter code
- Return ONLY the JSON object`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 700,
      temperature: 0.65,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `API error ${response.status}`;
    try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch { }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = (data.choices[0]?.message?.content || "").trim();

  // Robust JSON extraction
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Strip markdown code fences if model added them anyway
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      parsed = JSON.parse(fenceMatch[1].trim());
    } else {
      // Find first { ... } block
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        throw new Error("AI returned an unexpected format. Please try again.");
      }
    }
  }

  console.log("[CBot] raw starter:", JSON.stringify(parsed.starter));
  return { ...parsed, topic, difficulty: level };
}

// ──────────────────────────────────────────
//  LOAD NEXT QUESTION FLOW
// ──────────────────────────────────────────
async function loadNextQuestion() {
  currentTopic = selectNextTopic();
  const level = knowledge[currentTopic].level;

  // Show generating state, hide old content
  showGenerating(`Generating a ${level} question on "${currentTopic}"…`);
  resetUIForNewQuestion();

  try {
    currentQuestion = await generateQuestion(currentTopic, level);
    renderQuestion(currentQuestion);
  } catch (err) {
    showGenerating(`⚠️ ${err.message} — retrying…`);
    // One retry after 1.5s
    await sleep(1500);
    try {
      currentQuestion = await generateQuestion(currentTopic, level);
      renderQuestion(currentQuestion);
    } catch (err2) {
      showGenerating(`❌ ${err2.message}. Refresh to try again.`);
    }
  }
}

function showGenerating(msg) {
  elQGen.style.display = "flex";
  elQContent.style.display = "none";
  elQGenMsg.textContent = msg;
}

// ──────────────────────────────────────────
//  C CODE FORMATTER (flat-line fallback)
// ──────────────────────────────────────────
function formatCCode(code) {
  // Insert newlines around { } ; to convert flat code to multi-line
  let result = "";
  let indent = 0;
  const IND = "    ";     // 4 spaces per level

  // Tokenise character by character
  let i = 0;
  while (i < code.length) {
    const ch = code[i];

    // Skip existing whitespace runs (we're re-building indentation)
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }

    if (ch === "\n") {
      i++;
      continue;
    }

    if (ch === "{") {
      result += " {\n";
      indent++;
      result += IND.repeat(indent);
      i++;
      continue;
    }

    if (ch === "}") {
      indent = Math.max(0, indent - 1);
      // Trim trailing spaces from last line
      result = result.trimEnd();
      result += "\n" + IND.repeat(indent) + "}\n";
      // Peek: if next non-space char is NOT } or ), add blank line
      const rest = code.slice(i + 1).trimStart();
      if (rest && rest[0] !== "}" && rest[0] !== ")") {
        result += IND.repeat(indent);
      } else {
        result += IND.repeat(indent);
      }
      i++;
      continue;
    }

    if (ch === ";") {
      result += ";\n" + IND.repeat(indent);
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result.trim();
}

function renderQuestion(q) {
  elQGen.style.display = "none";
  elQContent.style.display = "block";

  elDifficulty.textContent = cap(q.difficulty);
  elDifficulty.className = "difficulty-tag " + q.difficulty.toLowerCase();
  elConcept.textContent = q.topic;
  elTitle.textContent = q.title;
  elBody.innerHTML = q.body;
  elHintText.textContent = q.hint;

  // Starter code — normalize to real newlines
  const raw = q.starter || "";
  let starterCode;
  if (raw.includes("\n")) {
    // Already has real newlines (AI followed prompt correctly)
    starterCode = raw;
  } else if (raw.includes("\\n")) {
    // Literal \n sequences — unescape them
    starterCode = raw.replace(/\\n/g, "\n").replace(/\\t/g, "    ");
  } else {
    // Flat single line — use basic formatter to re-introduce line breaks
    starterCode = formatCCode(raw);
  }
  console.log("[CBot] final starterCode lines:", starterCode.split("\n").length);
  cmEditor.setValue(starterCode);
  cmEditor.clearHistory();
  setTimeout(() => cmEditor.setCursor({ line: 0, ch: 0 }), 30);

  // Header chips
  elChipTopic.textContent = "📚 " + q.topic;
  elChipLevel.textContent = cap(q.difficulty);
  elChipLevel.className = "chip chip-level " + q.difficulty.toLowerCase();
  elChipCount.textContent = `Q: ${questionCount + 1}`;

  // Progress: ratio of topics with ≥1 attempt
  const attempted = TOPICS.filter(t => knowledge[t].attempts > 0 || knowledge[t].skips > 0).length;
  elGlobalProg.style.width = ((attempted / TOPICS.length) * 100) + "%";

  elBtnSubmit.disabled = false;
  elBtnSkip.disabled = false;

  cmEditor.focus();
  renderKnowledgeProfile();
}

function resetUIForNewQuestion() {
  elBtnSubmit.disabled = true;
  elBtnSkip.disabled = true;
  elBtnNext.style.display = "none";
  elFeedback.style.display = "none";
  elLoading.style.display = "none";

  // Remove any skip-notice
  document.querySelectorAll(".skip-notice").forEach(el => el.remove());

  elHintBox.style.display = "none";
  elBtnHint.textContent = "💡 Show Hint";
}

// ──────────────────────────────────────────
//  HINT
// ──────────────────────────────────────────
elBtnHint.addEventListener("click", () => {
  const shown = elHintBox.style.display !== "none";
  elHintBox.style.display = shown ? "none" : "flex";
  elBtnHint.textContent = shown ? "💡 Show Hint" : "🙈 Hide Hint";
});

// ──────────────────────────────────────────
//  EDITOR HELPERS
// ──────────────────────────────────────────
elBtnClear.addEventListener("click", () => {
  const raw = currentQuestion?.starter || "";
  const starterCode = raw.includes("\n")
    ? raw
    : raw.replace(/\\n/g, "\n").replace(/\\t/g, "    ");
  cmEditor.setValue(starterCode);
  cmEditor.clearHistory();
  cmEditor.focus();
});

elBtnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(cmEditor.getValue());
    elBtnCopy.textContent = "✅";
    setTimeout(() => (elBtnCopy.textContent = "📋"), 1500);
  } catch { }
});

// ──────────────────────────────────────────
//  SUBMIT → GROQ FEEDBACK (streaming)
// ──────────────────────────────────────────
elBtnSubmit.addEventListener("click", async () => {
  if (isSubmitting) return;
  const code = cmEditor.getValue().trim();
  if (!code || code === (currentQuestion?.starter || "").trim()) {
    shakePulse(elBtnSubmit);
    return;
  }
  await evaluateCode(code);
});

async function evaluateCode(code) {
  isSubmitting = true;
  elBtnSubmit.disabled = true;
  elBtnSkip.disabled = true;
  elFeedback.style.display = "none";
  elLoading.style.display = "flex";
  elBtnNext.style.display = "none";

  const q = currentQuestion;

  const systemPrompt = `You are CBot, an expert C programming and Operating Systems tutor. Review student code submissions and give structured, encouraging feedback.

Format your response EXACTLY as:

VERDICT: [Correct / Partially Correct / Needs Work]
SCORE: [0-10]

SUMMARY:
[2-3 sentence summary]

WHAT'S GOOD:
- [point]

WHAT TO IMPROVE:
- [point if any]

CORRECTED CODE (if needed):
\`\`\`c
[corrected code or write: No corrections needed.]
\`\`\`

TIP:
[One actionable C/OS tip]

Be specific, encouraging, and concise.`;

  const userPrompt = `OS/C Topic: ${q.topic}
Difficulty: ${q.difficulty}
Question: ${q.title}

Task:
${q.body.replace(/<[^>]+>/g, "")}

Student Code:
\`\`\`c
${code}
\`\`\``;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 900,
        temperature: 0.35,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `API error ${response.status}`;
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch { }
      throw new Error(errMsg);
    }

    elLoading.style.display = "none";
    elFeedback.style.display = "flex";
    elFeedVerdict.textContent = "";
    elFeedBody.innerHTML = "";
    elFeedScore.textContent = "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content || "";
          fullText += delta;
          renderFeedbackHTML(fullText);
        } catch { }
      }
    }

    // Parse score & update knowledge
    const score = parseFeedbackMeta(fullText);
    updateKnowledgeAfterAttempt(currentTopic, score);

    questionCount++;
    practiceRound++;
    elBtnNext.style.display = "flex";

  } catch (err) {
    elLoading.style.display = "none";
    elFeedback.style.display = "flex";
    elFeedVerdict.textContent = "Error";
    elFeedVerdict.className = "feedback-subtitle incorrect";
    elFeedBody.innerHTML = `<strong>⚠️ ${err.message}</strong><br>Check your connection and try again.`;
    elBtnNext.style.display = "flex";
  } finally {
    isSubmitting = false;
    elBtnSubmit.disabled = false;
  }
}

// ──────────────────────────────────────────
//  SKIP
// ──────────────────────────────────────────
elBtnSkip.addEventListener("click", () => {
  if (!currentQuestion) return;

  // Record skip
  const k = knowledge[currentTopic];
  k.skips++;
  k.needsPractice = true;
  k.consecutiveBad++;
  if (k.consecutiveBad >= 2 && k.level !== "beginner") {
    k.level = k.level === "advanced" ? "intermediate" : "beginner";
    k.consecutiveBad = 0;
  }

  questionCount++;
  practiceRound++;

  // Show a skip notice above the Next button
  elFeedback.style.display = "none";
  elLoading.style.display = "none";

  // Inject skip notice
  const notice = document.createElement("div");
  notice.className = "skip-notice";
  notice.innerHTML = `⚠️ Topic "<strong>${currentTopic}</strong>" marked for extra practice. We'll revisit it soon.`;
  document.querySelector(".code-panel").insertBefore(
    notice,
    document.querySelector(".action-row").nextSibling
  );

  elBtnSubmit.disabled = true;
  elBtnSkip.disabled = true;
  elBtnNext.style.display = "flex";

  renderKnowledgeProfile();
});

// ──────────────────────────────────────────
//  NEXT QUESTION
// ──────────────────────────────────────────
elBtnNext.addEventListener("click", () => {
  loadNextQuestion();
});

// ──────────────────────────────────────────
//  KNOWLEDGE UPDATE AFTER ATTEMPT
// ──────────────────────────────────────────
function updateKnowledgeAfterAttempt(topic, score) {
  const k = knowledge[topic];
  k.attempts++;
  k.scores.push(score);

  if (score >= 7) {
    k.consecutiveGood++;
    k.consecutiveBad = 0;
    // Mark recovered if they score well
    if (score >= 7 && k.needsPractice) k.needsPractice = false;
    // Level up after 2 consecutive good scores
    if (k.consecutiveGood >= 2 && k.level !== "advanced") {
      k.level = k.level === "beginner" ? "intermediate" : "advanced";
      k.consecutiveGood = 0;
    }
  } else {
    k.consecutiveBad++;
    k.consecutiveGood = 0;
    k.needsPractice = true;
    // Level down after 2 consecutive bad scores
    if (k.consecutiveBad >= 2 && k.level !== "beginner") {
      k.level = k.level === "advanced" ? "intermediate" : "beginner";
      k.consecutiveBad = 0;
    }
  }

  totalScore += score;
  elChipScore.textContent = `⭐ Score: ${totalScore}`;
  renderKnowledgeProfile();
}

// ──────────────────────────────────────────
//  KNOWLEDGE PROFILE RENDERER
// ──────────────────────────────────────────
function renderKnowledgeProfile() {
  elKpBody.innerHTML = "";

  TOPICS.forEach(topic => {
    const k = knowledge[topic];
    const avg = avgScore(topic);
    const row = document.createElement("div");
    row.className = "topic-row";

    // Status label
    let statusLabel, statusClass;
    if (k.attempts === 0 && k.skips === 0) {
      statusLabel = "Not started"; statusClass = "status-new";
    } else if (k.skips > 0 && k.attempts === 0) {
      statusLabel = `Skipped ${k.skips}×`; statusClass = "status-skipped";
    } else if (k.needsPractice) {
      statusLabel = "Needs practice"; statusClass = "status-practice";
    } else if (avg >= 7) {
      statusLabel = "Good"; statusClass = "status-good";
    } else {
      statusLabel = "In progress"; statusClass = "status-new";
    }

    // Score dots (last 5 scores + skips)
    const dotsHTML = buildDots(k);

    row.innerHTML = `
      <span class="topic-name">${topic}</span>
      <div class="topic-dots">${dotsHTML}</div>
      <span class="topic-level-badge level-${k.level}">${k.level[0].toUpperCase()}</span>
      <span class="topic-status ${statusClass}">${statusLabel}</span>
    `;
    elKpBody.appendChild(row);
  });
}

function buildDots(k) {
  const dots = [];
  // Show up to 5 score dots
  const recent = k.scores.slice(-5);
  recent.forEach(s => {
    const cls = s >= 7 ? "good" : s >= 5 ? "ok" : "bad";
    dots.push(`<div class="topic-dot ${cls}" title="Score: ${s}/10"></div>`);
  });
  // Skips as grey dots
  for (let i = 0; i < Math.min(k.skips, 3); i++) {
    dots.push(`<div class="topic-dot skipped" title="Skipped"></div>`);
  }
  return dots.join("");
}

// ──────────────────────────────────────────
//  FEEDBACK RENDERING
// ──────────────────────────────────────────
function renderFeedbackHTML(text) {
  let html = escapeHTML(text);

  html = html.replace(/```c\n?([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`);
  html = html.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^([A-Z][A-Z &()]+:)/gm,
    '<span style="color:var(--accent);font-weight:700;display:block;margin-top:12px;margin-bottom:3px;">$1</span>');
  html = html.replace(/^- (.+)/gm,
    '<span style="display:flex;gap:7px;margin:2px 0;"><span style="color:var(--accent);flex-shrink:0;">▸</span><span>$1</span></span>');
  html = html.replace(/\n/g, "<br>");
  // Fix <br> inside <pre>
  html = html.replace(/<pre>([\s\S]*?)<\/pre>/g,
    (_, inner) => `<pre>${inner.replace(/<br>/g, "\n")}</pre>`);

  elFeedBody.innerHTML = html;
}

function parseFeedbackMeta(text) {
  const verdictMatch = text.match(/VERDICT:\s*(Correct|Partially Correct|Needs Work)/i);
  const verdict = verdictMatch ? verdictMatch[1] : "Reviewed";

  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const score = scoreMatch ? Math.min(10, parseInt(scoreMatch[1])) : 5;

  elFeedVerdict.textContent = verdict;
  if (verdict === "Correct") {
    elFeedVerdict.className = "feedback-subtitle correct";
    elFeedScore.className = "score-badge good";
  } else if (verdict === "Partially Correct") {
    elFeedVerdict.className = "feedback-subtitle partial";
    elFeedScore.className = "score-badge ok";
  } else {
    elFeedVerdict.className = "feedback-subtitle incorrect";
    elFeedScore.className = "score-badge bad";
  }

  elFeedScore.textContent = `${score}/10`;
  return score;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────
//  KNOWLEDGE PANEL TOGGLE
// ──────────────────────────────────────────
elKpToggle.addEventListener("click", () => {
  elKpBody.classList.toggle("hidden");
  elKpToggle.classList.toggle("collapsed");
});

// ──────────────────────────────────────────
//  UTILS
// ──────────────────────────────────────────
function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function shakePulse(el) {
  el.style.animation = "none";
  void el.offsetHeight;
  el.style.animation = "shakePulse 0.4s ease";
  setTimeout(() => (el.style.animation = ""), 400);
}

// ──────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────
async function boot() {
  try {
    const docRef = doc(db, "config", "api_keys");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      GROQ_API_KEY = docSnap.data().groq;
    } else {
      console.error("API key document not found in Firestore! Make sure you created the document at config/api_keys with a 'groq' field.");
      alert("Missing API Key! See console for details.");
    }
  } catch (err) {
    console.error("Error fetching API key from Firestore:", err);
    alert("Could not connect to Firebase! Make sure you updated firebaseConfig in app.js");
  }

  renderKnowledgeProfile();
  loadNextQuestion();
}

boot();
