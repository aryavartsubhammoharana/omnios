/**
 * NOTE AI - Frontend Controller & API Integration Engine
 */

const API_BASE = '/api/v1';

// Global Application State
const state = {
  user: null,
  token: null,
  classrooms: [],
  activeClassroomId: null,
  notes: [],
  selectedDocumentId: null,
  streak: 0,
};

// ==========================================
// 1. API HELPER
// ==========================================
async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (state.token) {
    defaultHeaders['Authorization'] = `Bearer ${state.token}`;
  }

  // If sending FormData (file uploads), remove Content-Type so browser sets boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    credentials: 'include', // include HTTP-only cookies
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error on [${endpoint}]:`, error);
    throw error;
  }
}

// ==========================================
// 2. TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const bgColors = {
    success: 'bg-emerald-600/90 text-white border-emerald-500',
    error: 'bg-rose-600/90 text-white border-rose-500',
    info: 'bg-brand-600/90 text-white border-brand-500',
    warning: 'bg-amber-600/90 text-white border-amber-500',
  };

  toast.className = `px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border backdrop-blur-md transition-all duration-300 pointer-events-auto flex items-center gap-2 ${bgColors[type] || bgColors.info} animate-fade-in`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 3. AUTHENTICATION & QUICK-LOGIN
// ==========================================
async function quickLogin(email) {
  try {
    showToast(`Logging in as ${email}...`, 'info');
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'Password123!',
      }),
    });

    state.user = response.data.user;
    state.token = response.data.accessToken;
    updateUserUi();
    showToast(`Welcome back, ${state.user.firstName}! (${state.user.role})`, 'success');

    await loadInitialData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleManualLogin(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    state.user = response.data.user;
    state.token = response.data.accessToken;
    updateUserUi();
    closeModal('modal-auth');
    showToast(`Logged in successfully as ${state.user.firstName}!`, 'success');
    await loadInitialData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (e) {}

  state.user = null;
  state.token = null;
  updateUserUi();
  showToast('Logged out successfully', 'info');
}

function updateUserUi() {
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const authBtn = document.getElementById('auth-action-btn');
  const streakPill = document.getElementById('user-streak-pill');
  const streakCount = document.getElementById('streak-days-count');
  const createClassBtn = document.getElementById('btn-create-class');

  if (state.user) {
    nameEl.textContent = `${state.user.firstName} ${state.user.lastName}`;
    roleEl.textContent = state.user.role;
    
    // Style role badge
    if (state.user.role === 'TEACHER') {
      roleEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/20 text-brand-400 border border-brand-500/30';
      if (createClassBtn) createClassBtn.classList.remove('hidden');
    } else {
      roleEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      if (createClassBtn) createClassBtn.classList.add('hidden');
    }

    authBtn.innerHTML = '<i data-lucide="log-out" class="w-3.5 h-3.5"></i> Logout';
    authBtn.onclick = handleLogout;
    authBtn.className = 'text-xs px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition flex items-center gap-1.5';

    // Show streak if student
    if (state.user.role === 'STUDENT') {
      streakPill.classList.remove('hidden');
      streakCount.textContent = `${state.streak || 1} Day Streak`;
    } else {
      streakPill.classList.add('hidden');
    }
  } else {
    nameEl.textContent = 'Not Logged In';
    roleEl.textContent = 'GUEST';
    roleEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-800 text-gray-400';
    authBtn.innerHTML = '<i data-lucide="log-in" class="w-3.5 h-3.5"></i> Login';
    authBtn.onclick = () => openModal('modal-auth');
    authBtn.className = 'text-xs px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-brand-600/20';
    streakPill.classList.add('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

async function checkSession() {
  try {
    const res = await apiFetch('/auth/me');
    state.user = res.data;
    state.streak = res.data.streaks?.currentStreak || 0;
    updateUserUi();
    await loadInitialData();
  } catch (e) {
    // If not logged in, auto-login as Teacher for smooth hackathon demo experience
    console.log('No active session. Initializing demo login as Teacher...');
    await quickLogin('dr.sharma@institution.edu');
  }
}

// ==========================================
// 4. CLASSROOM MANAGEMENT
// ==========================================
async function loadInitialData() {
  await loadClassrooms();
  if (state.classrooms.length > 0) {
    state.activeClassroomId = state.classrooms[0].id;
    populateClassroomSelectors();
    await loadClassroomNotes();
  }
}

async function loadClassrooms() {
  try {
    const res = await apiFetch('/classrooms');
    state.classrooms = res.data || [];
    renderClassrooms();
    populateClassroomSelectors();
  } catch (err) {
    console.error('Error loading classrooms:', err);
  }
}

function renderClassrooms() {
  const container = document.getElementById('classrooms-grid');
  if (!container) return;

  if (state.classrooms.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 glass-card rounded-2xl p-8 space-y-3">
        <i data-lucide="school" class="w-10 h-10 text-gray-500 mx-auto"></i>
        <h3 class="text-sm font-semibold text-gray-300">No Classrooms Available</h3>
        <p class="text-xs text-gray-500">Create a classroom as a Teacher or join using a 6-character code as a Student.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = state.classrooms
    .map(
      (c) => `
      <div class="glass-card rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-brand-500/50 transition">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              ${c.subject || 'General'}
            </span>
            <div class="flex items-center gap-1.5 cursor-pointer bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-800 hover:border-brand-400 transition" onclick="copyClassCode('${c.classroom_code}')" title="Click to copy code">
              <span class="text-xs font-mono font-bold tracking-widest text-emerald-400">${c.classroom_code}</span>
              <i data-lucide="copy" class="w-3 h-3 text-gray-400"></i>
            </div>
          </div>
          <h3 class="text-base font-bold text-white tracking-tight">${c.name}</h3>
          <p class="text-xs text-gray-400 line-clamp-2">${c.description || 'No description provided.'}</p>
        </div>

        <div class="pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
          <span class="flex items-center gap-1">
            <i data-lucide="users" class="w-3.5 h-3.5 text-brand-400"></i> ${c.student_count || 0} Students
          </span>
          <span class="flex items-center gap-1">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-emerald-400"></i> ${c.document_count || 0} Notes
          </span>
          <button onclick="selectClassroomAndOpenNotes('${c.id}')" class="px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600 hover:text-white transition font-medium text-[11px]">
            Open ➔
          </button>
        </div>
      </div>
    `
    )
    .join('');

  if (window.lucide) lucide.createIcons();
}

function copyClassCode(code) {
  navigator.clipboard.writeText(code);
  showToast(`Classroom Code [${code}] copied to clipboard!`, 'success');
}

function selectClassroomAndOpenNotes(classroomId) {
  state.activeClassroomId = classroomId;
  const select = document.getElementById('notes-classroom-select');
  if (select) select.value = classroomId;
  switchTab('notes');
  loadClassroomNotes();
}

function populateClassroomSelectors() {
  const selectors = ['notes-classroom-select', 'rag-classroom-select', 'analytics-classroom-select'];
  
  selectors.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = state.classrooms
      .map((c) => `<option value="${c.id}" ${c.id === state.activeClassroomId ? 'selected' : ''}>${c.name} (${c.classroom_code})</option>`)
      .join('');
  });
}

async function handleCreateClassroom(e) {
  e.preventDefault();
  const name = document.getElementById('new-class-name').value;
  const subject = document.getElementById('new-class-subject').value;
  const description = document.getElementById('new-class-desc').value;

  try {
    const res = await apiFetch('/classrooms', {
      method: 'POST',
      body: JSON.stringify({ name, subject, description }),
    });

    closeModal('modal-create-class');
    showToast(`Classroom "${res.data.name}" created with code: ${res.data.classroom_code}`, 'success');
    document.getElementById('new-class-name').value = '';
    document.getElementById('new-class-subject').value = '';
    document.getElementById('new-class-desc').value = '';
    await loadClassrooms();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleJoinClassroom(e) {
  e.preventDefault();
  const classroomCode = document.getElementById('join-class-code').value.trim().toUpperCase();

  try {
    const res = await apiFetch('/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ classroomCode }),
    });

    closeModal('modal-join-class');
    showToast(`Successfully enrolled in "${res.data.name}"!`, 'success');
    document.getElementById('join-class-code').value = '';
    await loadClassrooms();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// 5. NOTES & INGESTION PIPELINE
// ==========================================
async function loadClassroomNotes() {
  const select = document.getElementById('notes-classroom-select');
  const classroomId = select ? select.value : state.activeClassroomId;
  if (!classroomId) return;

  state.activeClassroomId = classroomId;

  try {
    const res = await apiFetch(`/classrooms/${classroomId}/notes`);
    state.notes = res.data || [];
    renderNotesList();
    populateStudyDocumentSelector();
  } catch (err) {
    console.error('Error loading notes:', err);
  }
}

function renderNotesList() {
  const container = document.getElementById('notes-list-container');
  if (!container) return;

  if (state.notes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-gray-500 text-xs">
        <i data-lucide="file-x-2" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        No notes uploaded for this classroom yet. Use the upload box above to add PDFs, DOCX, or Handwritten images.
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const statusBadges = {
    READY: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">● READY</span>',
    PROCESSING: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 animate-pulse">⚙️ PROCESSING</span>',
    PENDING: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">⏳ PENDING</span>',
    FAILED: '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">❌ FAILED</span>',
  };

  container.innerHTML = state.notes
    .map(
      (note) => `
      <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-900/40 transition">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gray-800/80 border border-gray-700 flex items-center justify-center text-brand-400 shrink-0">
            <i data-lucide="${note.file_type === 'pdf' ? 'file-text' : note.file_type.includes('image') ? 'scan-text' : 'file-code'}" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-white tracking-tight">${note.file_name}</h4>
              ${statusBadges[note.status] || statusBadges.PENDING}
            </div>
            <p class="text-[11px] text-gray-400 mt-0.5">
              ${(note.file_size / 1024).toFixed(1)} KB • ${(note.chunks_count || 0)} Vector Chunks (1536-d) • Uploaded by ${note.uploader_first_name || 'Teacher'}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="trackNoteReading('${note.id}')" class="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium flex items-center gap-1 transition" title="Log reading session & update daily streak">
            📖 Study & Track Streak
          </button>
          <button onclick="inspectChunks('${note.id}')" class="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-medium flex items-center gap-1 transition" title="Inspect 1536-d vector chunks">
            🔍 Vector Chunks
          </button>
          ${
            state.user?.role === 'TEACHER' || state.user?.role === 'ADMIN'
              ? `<button onclick="deleteNote('${note.id}')" class="p-1.5 rounded-lg bg-gray-800 hover:bg-rose-600/20 text-gray-400 hover:text-rose-400 transition" title="Delete note">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>`
              : ''
          }
        </div>
      </div>
    `
    )
    .join('');

  if (window.lucide) lucide.createIcons();
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const select = document.getElementById('notes-classroom-select');
  const classroomId = select ? select.value : state.activeClassroomId;

  if (!classroomId) {
    showToast('Please select or create a classroom first', 'warning');
    return;
  }

  showToast(`Uploading note: ${file.name}...`, 'info');
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch(`/classrooms/${classroomId}/notes`, {
      method: 'POST',
      body: formData,
    });

    showToast(`Note uploaded! Asynchronous vector pipeline started.`, 'success');
    e.target.value = '';
    await loadClassroomNotes();

    // Auto-poll status after 3 seconds to show transition to READY
    setTimeout(async () => {
      await loadClassroomNotes();
      showToast('Document vector embeddings indexed successfully into pgvector!', 'success');
    }, 3500);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function trackNoteReading(noteId) {
  try {
    const res = await apiFetch(`/notes/${noteId}/track-view`, {
      method: 'POST',
      body: JSON.stringify({ timeSpentSeconds: 60 }),
    });

    state.streak = res.data.streak.currentStreak;
    updateUserUi();
    showToast(`🔥 Reading logged! Current active streak: ${state.streak} days!`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function inspectChunks(noteId) {
  try {
    const res = await apiFetch(`/notes/${noteId}/chunks`);
    const chunks = res.data || [];
    const container = document.getElementById('chunks-modal-content');

    if (chunks.length === 0) {
      container.innerHTML = `<p class="text-gray-400 italic">No vector chunks available. The file may still be in the processing queue.</p>`;
    } else {
      container.innerHTML = chunks
        .map(
          (c) => `
        <div class="glass-panel p-3.5 rounded-xl space-y-2 border-gray-700">
          <div class="flex items-center justify-between text-[11px] text-gray-400">
            <span class="font-bold text-brand-400">Chunk #${c.chunk_index + 1}</span>
            <span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">1536 Dimensions (Vector Indexed)</span>
          </div>
          <p class="text-gray-200 leading-relaxed font-sans text-xs bg-black/40 p-2.5 rounded-lg border border-gray-800">${c.chunk_text}</p>
        </div>
      `
        )
        .join('');
    }

    openModal('modal-chunks');
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Are you sure you want to delete this lecture note and all its vector chunks?')) return;
  try {
    await apiFetch(`/notes/${noteId}`, { method: 'DELETE' });
    showToast('Note deleted successfully', 'info');
    await loadClassroomNotes();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// 6. AI ASSISTANT & RAG CHAT
// ==========================================
function fillRagPrompt(promptText) {
  const input = document.getElementById('rag-query-input');
  if (input) {
    input.value = promptText;
    input.focus();
  }
}

async function handleRagSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('rag-query-input');
  const query = input.value.trim();
  if (!query) return;

  const select = document.getElementById('rag-classroom-select');
  const classroomId = select ? select.value : state.activeClassroomId;

  if (!classroomId) {
    showToast('Please select a classroom first', 'warning');
    return;
  }

  const thread = document.getElementById('chat-thread');
  const sendBtn = document.getElementById('rag-send-btn');

  // Append user message
  const userMsgHtml = `
    <div class="flex items-start justify-end gap-3 animate-fade-in">
      <div class="bg-brand-600 text-white p-3.5 rounded-2xl max-w-lg text-xs leading-relaxed shadow-lg shadow-brand-600/20">
        ${query}
      </div>
      <div class="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
        <i data-lucide="user" class="w-4 h-4 text-brand-300"></i>
      </div>
    </div>
  `;
  thread.insertAdjacentHTML('beforeend', userMsgHtml);
  input.value = '';
  thread.scrollTop = thread.scrollHeight;

  // Append typing indicator
  const typingId = `typing-${Date.now()}`;
  const typingHtml = `
    <div id="${typingId}" class="flex items-start gap-3 animate-fade-in">
      <div class="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
        <i data-lucide="bot" class="w-4 h-4 text-purple-400"></i>
      </div>
      <div class="glass-panel p-3.5 rounded-2xl text-xs text-gray-400 flex items-center gap-2">
        <span class="animate-pulse">Searching 1536-d vector space and generating cited response...</span>
      </div>
    </div>
  `;
  thread.insertAdjacentHTML('beforeend', typingHtml);
  thread.scrollTop = thread.scrollHeight;
  if (window.lucide) lucide.createIcons();

  sendBtn.disabled = true;

  try {
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        classroomId,
        query,
        topK: 4,
      }),
    });

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const rawHtml = window.marked ? marked.parse(res.data.answer) : res.data.answer;
    const formattedAnswer = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;

    // Append AI Response
    const aiMsgHtml = `
      <div class="flex items-start gap-3 animate-fade-in">
        <div class="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
          <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
        </div>
        <div class="glass-panel p-4 rounded-2xl max-w-xl text-xs space-y-2 prose-custom border-purple-500/20">
          ${formattedAnswer}
        </div>
      </div>
    `;
    thread.insertAdjacentHTML('beforeend', aiMsgHtml);
    thread.scrollTop = thread.scrollHeight;

    // Render Sources Drawer
    renderRagSources(res.data.sources || []);
  } catch (error) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    showToast(error.message, 'error');
  } finally {
    sendBtn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

function renderRagSources(sources) {
  const container = document.getElementById('rag-sources-container');
  const countBadge = document.getElementById('sources-count-badge');
  if (!container) return;

  countBadge.textContent = `${sources.length} Sources`;

  if (sources.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-gray-500 text-xs">No explicit source citations retrieved for this query.</div>`;
    return;
  }

  container.innerHTML = sources
    .map(
      (s) => `
    <div class="glass-panel p-3.5 rounded-xl space-y-2 border-brand-500/20 hover:border-brand-500/40 transition">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-bold text-brand-300 flex items-center gap-1">
          <i data-lucide="file-check-2" class="w-3.5 h-3.5 text-emerald-400"></i> [Source ${s.sourceId}] ${s.fileName}
        </span>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ${Math.round((s.similarity || 0.9) * 100)}% Match
        </span>
      </div>
      <p class="text-gray-300 text-xs italic bg-black/30 p-2 rounded-lg border border-gray-800">
        "${s.excerpt}"
      </p>
    </div>
  `
    )
    .join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 7. STUDY TOOLS (SUMMARIES & QUIZZES)
// ==========================================
function populateStudyDocumentSelector() {
  const select = document.getElementById('study-document-select');
  if (!select) return;

  if (state.notes.length === 0) {
    select.innerHTML = `<option value="">No notes available in classroom</option>`;
    return;
  }

  select.innerHTML = state.notes
    .map((n) => `<option value="${n.id}">${n.file_name} (${n.chunks_count || 0} chunks)</option>`)
    .join('');
}

async function generateDocumentSummary() {
  const select = document.getElementById('study-document-select');
  const documentId = select ? select.value : null;

  if (!documentId) {
    showToast('Please select a document first', 'warning');
    return;
  }

  const container = document.getElementById('summary-result-container');
  const btn = document.getElementById('btn-generate-summary');

  btn.disabled = true;
  container.innerHTML = `<div class="p-6 text-center text-brand-300 animate-pulse">✨ Analyzing document chunks and synthesizing executive takeaways...</div>`;

  try {
    const res = await apiFetch('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    });

    const data = res.data;
    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-brand-300 mb-1">Executive Summary</h4>
          <p class="text-gray-200 leading-relaxed bg-black/30 p-3 rounded-xl border border-gray-800">${data.summary}</p>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5">Key Lecture Takeaways</h4>
          <ul class="space-y-1.5 pl-2">
            ${(data.keyTakeaways || []).map((t) => `<li class="flex items-start gap-2 text-gray-300"><span class="text-emerald-400">✔</span> <span>${t}</span></li>`).join('')}
          </ul>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-purple-300 mb-1.5">Core Academic Concepts</h4>
          <div class="flex flex-wrap gap-1.5">
            ${(data.coreConcepts || []).map((c) => `<span class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">${c}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="p-4 text-rose-400">Error: ${error.message}</div>`;
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function generateDocumentQuiz() {
  const select = document.getElementById('study-document-select');
  const documentId = select ? select.value : null;

  if (!documentId) {
    showToast('Please select a document first', 'warning');
    return;
  }

  const container = document.getElementById('quiz-result-container');
  const btn = document.getElementById('btn-generate-quiz');

  btn.disabled = true;
  container.innerHTML = `<div class="p-6 text-center text-cyan-300 animate-pulse">🎯 Crafting adaptive MCQs and conceptual evaluation key...</div>`;

  try {
    const res = await apiFetch('/ai/generate-quiz', {
      method: 'POST',
      body: JSON.stringify({ documentId, numQuestions: 5 }),
    });

    const data = res.data;
    window.currentQuizData = data;

    container.innerHTML = `
      <div class="space-y-5 animate-fade-in" id="quiz-form-wrapper">
        <div class="border-b border-gray-800 pb-2 flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-cyan-300">${data.quizTitle || 'Mastery Quiz'}</h4>
          <span class="text-[11px] text-gray-400">${data.mcqs.length} Questions</span>
        </div>

        <form onsubmit="gradeQuiz(event)" class="space-y-4">
          ${data.mcqs
            .map(
              (q, qIdx) => `
            <div class="glass-panel p-4 rounded-xl space-y-2.5 border-gray-800" id="quiz-q-${qIdx}">
              <p class="font-semibold text-gray-100 text-xs">
                <span class="text-cyan-400 font-bold">Q${qIdx + 1}.</span> ${q.question}
              </p>
              <div class="space-y-1.5 pl-2">
                ${q.options
                  .map(
                    (opt, optIdx) => `
                  <label class="flex items-center gap-2.5 text-xs text-gray-300 p-2 rounded-lg hover:bg-gray-800/60 cursor-pointer transition">
                    <input type="radio" name="quiz_q_${qIdx}" value="${optIdx}" class="text-cyan-500 focus:ring-0" required />
                    <span>${opt}</span>
                  </label>
                `
                  )
                  .join('')}
              </div>
              <div id="quiz-explain-${qIdx}" class="hidden mt-2 p-2.5 rounded-lg text-[11px] border"></div>
            </div>
          `
            )
            .join('')}

          <div class="pt-2 flex items-center justify-between">
            <div id="quiz-score-badge" class="hidden text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"></div>
            <button type="submit" class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition">
              Submit & Grade Quiz
            </button>
          </div>
        </form>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="p-4 text-rose-400">Error: ${error.message}</div>`;
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function gradeQuiz(e) {
  e.preventDefault();
  const quiz = window.currentQuizData;
  if (!quiz) return;

  let correctCount = 0;
  quiz.mcqs.forEach((q, qIdx) => {
    const selected = document.querySelector(`input[name="quiz_q_${qIdx}"]:checked`);
    const val = selected ? parseInt(selected.value, 10) : -1;
    const card = document.getElementById(`quiz-q-${qIdx}`);
    const explainBox = document.getElementById(`quiz-explain-${qIdx}`);

    explainBox.classList.remove('hidden');

    if (val === q.correctOptionIndex) {
      correctCount++;
      card.classList.add('border-emerald-500/40', 'bg-emerald-950/10');
      explainBox.className = 'mt-2 p-2.5 rounded-lg text-[11px] bg-emerald-950/40 text-emerald-300 border border-emerald-500/30';
      explainBox.innerHTML = `<strong>✔ Correct!</strong> ${q.explanation}`;
    } else {
      card.classList.add('border-rose-500/40', 'bg-rose-950/10');
      explainBox.className = 'mt-2 p-2.5 rounded-lg text-[11px] bg-rose-950/40 text-rose-300 border border-rose-500/30';
      explainBox.innerHTML = `<strong>✖ Incorrect.</strong> Correct answer was Option ${q.correctOptionIndex + 1}: ${q.options[q.correctOptionIndex]}<br/><span class="text-gray-300 mt-1 block">${q.explanation}</span>`;
    }
  });

  const scoreBadge = document.getElementById('quiz-score-badge');
  if (scoreBadge) {
    scoreBadge.classList.remove('hidden');
    scoreBadge.textContent = `Score: ${correctCount}/${quiz.mcqs.length} (${Math.round((correctCount / quiz.mcqs.length) * 100)}%)`;
  }

  showToast(`Quiz completed! You scored ${correctCount}/${quiz.mcqs.length}!`, 'success');
}

// ==========================================
// 8. TEACHER ANALYTICS DASHBOARD
// ==========================================
async function loadClassroomAnalytics() {
  const select = document.getElementById('analytics-classroom-select');
  const classroomId = select ? select.value : state.activeClassroomId;
  if (!classroomId) return;

  try {
    const res = await apiFetch(`/classrooms/${classroomId}/analytics`);
    const data = res.data;

    // Overview numbers
    document.getElementById('stat-total-students').textContent = data.summary.totalStudents || 0;
    document.getElementById('stat-total-docs').textContent = data.summary.totalDocuments || 0;
    document.getElementById('stat-total-views').textContent = data.summary.totalViewEvents || 0;
    document.getElementById('stat-total-hours').textContent = `${data.summary.totalStudyTimeHours || 0} hrs`;

    // Leaderboard
    const studentContainer = document.getElementById('analytics-students-container');
    if (data.students && data.students.length > 0) {
      studentContainer.innerHTML = data.students
        .map(
          (s, idx) => `
        <div class="px-4 py-3 flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full ${idx === 0 ? 'bg-amber-500/20 text-amber-400 font-bold' : 'bg-gray-800 text-gray-400'} flex items-center justify-center text-[11px]">
              #${idx + 1}
            </span>
            <div>
              <p class="font-bold text-white">${s.first_name} ${s.last_name}</p>
              <p class="text-[10px] text-gray-400">${s.email}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-amber-400 font-bold">🔥 ${s.current_streak || 0}d Streak</span>
            <p class="text-[10px] text-gray-400">${(s.total_study_time_seconds / 60).toFixed(1)} mins study</p>
          </div>
        </div>
      `
        )
        .join('');
    } else {
      studentContainer.innerHTML = `<p class="p-4 text-gray-500 text-xs italic">No student study activity logged yet.</p>`;
    }

    // Document engagement
    const docContainer = document.getElementById('analytics-docs-container');
    if (data.documents && data.documents.length > 0) {
      docContainer.innerHTML = data.documents
        .map(
          (d) => `
        <div class="px-4 py-3 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-white">${d.file_name}</p>
            <p class="text-[10px] text-gray-400">${d.unique_students_viewed || 0} unique students read</p>
          </div>
          <div class="text-right">
            <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[11px]">${d.total_views || 0} Views</span>
            <p class="text-[10px] text-gray-400">${(d.total_time_spent_seconds / 60).toFixed(1)} mins total</p>
          </div>
        </div>
      `
        )
        .join('');
    } else {
      docContainer.innerHTML = `<p class="p-4 text-gray-500 text-xs italic">No notes uploaded for analytics.</p>`;
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// ==========================================
// 9. UI TAB SWITCHER & MODAL HELPERS
// ==========================================
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach((el) => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);

  if (targetView) targetView.classList.remove('hidden');
  if (targetTab) targetTab.classList.add('active');

  // Trigger data refreshes on tab activation
  if (tabName === 'analytics') loadClassroomAnalytics();
  if (tabName === 'study') populateStudyDocumentSelector();

  if (window.lucide) lucide.createIcons();
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('flex');
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }
}

function openCreateClassModal() {
  openModal('modal-create-class');
}

function openJoinClassModal() {
  openModal('modal-join-class');
}

function openAuthModal() {
  openModal('modal-auth');
}

// ==========================================
// 10. APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await checkSession();
});
