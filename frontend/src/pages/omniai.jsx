import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { 
  Bot, User, Trash2, Plus, CheckSquare, Square, FileText, Loader2, Book, 
  ChevronDown, Filter, X, Layers, Send, Sparkles, Eye, Upload, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, ArrowRight, PanelLeftClose, PanelLeftOpen,
  Lightbulb, Calculator, HelpCircle, BookOpen, MessageSquarePlus, Zap
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function OmniChat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClassroomId = searchParams.get('classroom_id');
  const { user } = useContext(AuthContext);

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(initialClassroomId || 'all');

  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  const [readingDoc, setReadingDoc] = useState(null);
  const [docDetails, setDocDetails] = useState(null);
  const [loadingDocDetails, setLoadingDocDetails] = useState(false);
  const [readerViewMode, setReaderViewMode] = useState('pdf');
  const [readerFontSize, setReaderFontSize] = useState(14);
  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);

  const generateSecure14CharId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(14);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => chars[byte % chars.length]).join('');
    }
    let result = '';
    for (let i = 0; i < 14; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const [draftSession, setDraftSession] = useState(() => ({
    id: 'new',
    user_id: user?.id,
    title: 'New Conversation',
    messages: [],
    createdAt: new Date().toISOString()
  }));

  const [chatSessions, setChatSessions] = useState(() => {
    const storageKey = `omnios_chat_sessions_${user?.id || 'guest'}`;
    const legacyKey = `notebooklm_sessions_${user?.id || 'default'}`;
    const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(s => s && Array.isArray(s.messages) && s.messages.length > 0);
        }
      } catch (e) {
        console.warn("Could not parse saved sessions", e);
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (chatId && chatId !== 'new') return chatId;
    return 'new';
  });

  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!chatId || chatId === 'new') {
      setActiveSessionId('new');
      setDraftSession({
        id: 'new',
        user_id: user?.id,
        title: 'New Conversation',
        messages: [],
        createdAt: new Date().toISOString()
      });
      if (!chatId) {
        navigate('/omnichat/new', { replace: true });
      }
    } else {
      const existing = chatSessions.find(s => s.id === chatId);
      if (existing) {
        setActiveSessionId(chatId);
      } else {
        navigate('/omnichat/new', { replace: true });
      }
    }
  }, [chatId, user]);

  useEffect(() => {
    API.get('/api/classroom/list')
      .then((res) => setClassrooms(res.data))
      .catch((err) => console.error("Error loading classrooms", err));
  }, []);

  const fetchSources = () => {
    const url = (selectedClassroomId && selectedClassroomId !== 'all')
      ? `/api/upload/list?classroom_id=${selectedClassroomId}`
      : '/api/upload/list';

    API.get(url)
      .then((res) => {
        setAvailableDocs(res.data);
        if (res.data.length > 0) {
          setSelectedDocIds(res.data.map(d => d.id));
        } else {
          setSelectedDocIds([]);
        }
      })
      .catch((err) => console.error("Error loading document sources", err));
  };

  useEffect(() => {
    fetchSources();
  }, [selectedClassroomId]);

  useEffect(() => {
    const storageKey = `omnios_chat_sessions_${user?.id || 'guest'}`;
    const validSaved = chatSessions.filter(s => s && Array.isArray(s.messages) && s.messages.length > 0);
    localStorage.setItem(storageKey, JSON.stringify(validSaved));
  }, [chatSessions, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSessions, activeSessionId]);

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || draftSession;

  const toggleDocSelection = (docId) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllSources = () => {
    if (selectedDocIds.length === availableDocs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(availableDocs.map(d => d.id));
    }
  };

  const handleCreateNewSession = () => {
    setDraftSession({
      id: 'new',
      user_id: user?.id,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString()
    });
    setActiveSessionId('new');
    navigate('/omnichat/new');
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    const remaining = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(remaining);
    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
        navigate(`/omnichat/${remaining[0].id}`);
      } else {
        handleCreateNewSession();
      }
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(`Uploading ${files.length} file(s)...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Processing ${i + 1}/${files.length}: ${file.name}`);
        const formData = new FormData();
        formData.append('file', file);
        if (selectedClassroomId && selectedClassroomId !== 'all') {
          formData.append('classroom_id', selectedClassroomId);
        }

        await API.post('/api/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      fetchSources();
      setUploadProgress('Upload complete!');
      setTimeout(() => setUploadProgress(''), 2000);
    } catch (err) {
      console.error("Error uploading file", err);
      setUploadProgress('Upload failed. Please check format.');
      setTimeout(() => setUploadProgress(''), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await API.delete(`/api/upload/${docId}`);
      fetchSources();
      if (readingDoc?.id === docId) setReadingDoc(null);
    } catch (err) {
      console.error("Error deleting document", err);
    }
  };

  const handleOpenReader = (doc, e) => {
    if (e) e.stopPropagation();
    setReadingDoc(doc);
    setDocDetails(null);
    setLoadingDocDetails(true);
    setReaderFontSize(14);
    setIsReaderFullscreen(false);

    if (doc.filename.toLowerCase().endsWith('.pdf') && (doc.file_url && doc.file_url !== '/' && !doc.file_url.endsWith('/None'))) {
      setReaderViewMode('pdf');
    } else {
      setReaderViewMode('text');
    }

    API.get(`/api/upload/${doc.id}`)
      .then(res => setDocDetails(res.data))
      .catch(err => console.error("Error fetching doc text", err))
      .finally(() => setLoadingDocDetails(false));
  };

  const handleAskAboutDoc = () => {
    if (!readingDoc) return;
    handleSendQuestion(null, `Explain the key concepts and formulas from "${readingDoc.filename}"`);
    setReadingDoc(null);
    setIsSourcesModalOpen(false);
  };

  const handleSendQuestion = async (e, customText = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const userText = (customText || inputQuestion).trim();
    if (!userText || sending) return;

    setInputQuestion('');

    let currentSessionId = activeSessionId;
    const isCurrentInSaved = chatSessions.some(s => s.id === currentSessionId);

    if (!isCurrentInSaved || currentSessionId === 'new') {
      const new14CharId = generateSecure14CharId();
      const newCommittedSession = {
        id: new14CharId,
        user_id: user?.id,
        title: userText.slice(0, 26) + (userText.length > 26 ? '...' : ''),
        messages: [{ sender: 'user', text: userText }],
        createdAt: new Date().toISOString()
      };
      setChatSessions(prev => [newCommittedSession, ...prev]);
      currentSessionId = new14CharId;
      setActiveSessionId(currentSessionId);
      navigate(`/omnichat/${currentSessionId}`, { replace: true });

      setDraftSession({
        id: 'new',
        user_id: user?.id,
        title: 'New Conversation',
        messages: [],
        createdAt: new Date().toISOString()
      });
    } else {
      setChatSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            title: s.messages.length === 0 ? userText.slice(0, 26) + (userText.length > 26 ? '...' : '') : s.title,
            messages: [...s.messages, { sender: 'user', text: userText }]
          };
        }
        return s;
      }));
    }

    setSending(true);

    try {
      const singleDocId = (selectedDocIds.length === 1) ? selectedDocIds[0] : null;
      const cId = (selectedClassroomId && selectedClassroomId !== 'all') ? parseInt(selectedClassroomId) : null;

      const res = await API.post('/api/ai/chat', {
        question: userText,
        document_id: singleDocId,
        classroom_id: cId,
        ai_provider: 'sarvam'
      });

      setChatSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, { sender: 'ai', text: res.data.answer, provider: res.data.provider_used }]
          };
        }
        return s;
      }));
    } catch (err) {
      console.error("Error calling AI chat:", err);
      setChatSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, { sender: 'ai', text: 'Sorry, I encountered an error answering your query. Please try again.' }]
          };
        }
        return s;
      }));
    } finally {
      setSending(false);
    }
  };

  const groupedDocsByClassroom = () => {
    const map = {};
    availableDocs.forEach((doc) => {
      let cName = 'Personal Notes';
      if (doc.classroom_id) {
        cName = classrooms.find(c => c.id === doc.classroom_id)?.name || 'Classroom Notes';
      }
      if (!map[cName]) map[cName] = [];
      map[cName].push(doc);
    });
    return map;
  };

  const isFreshSession = !activeSession?.messages || activeSession.messages.length === 0;

  const welcomeVibe = useMemo(() => {
    const vibes = [
      "Slay Today?", "No Cap?", "Vibe Check?", "Say Less.", "Let's Cook.",
      "We Cookin?", "Main Character?", "Era Loading...", "Lowkey Curious?", "Spill It.",
      "Rizz Up?", "Brain Rot?", "Hit Different?", "Understood, King?", "It's Giving?",
      "Understood, Queen?", "Pop Off?", "That's Bussin?", "Glow Up?", "Stay Pressed?",
      "Touch Grass?", "No Lore?", "Based Energy?", "Sigma Mode?", "Serve It.",
      "Rent Free?", "Understood, Bestie?", "Real Talk?", "Not Clickbait?", "Caught Lacking?",
      "Twin Flame?", "Era Change?", "Understood, Fam?", "Core Memory?", "That's Ate?",
      "Understood, Bro?", "Chefs Kiss?", "Understood, Sis?", "Rizz Check?", "Hot Take?",
      "NPC Energy?", "Plot Twist?", "Understood, Fr?", "No Gatekeeping?", "Fell Off?",
      "Peak Fiction?", "Understood, G?", "Quiet Luxury?", "Delulu Era?", "Snatched Up?",
      "Mid Check?", "We Ate?", "Era Reset?", "Understood, Babe?", "Understood, Luv?",
      "Villain Arc?", "Main Quest?", "Rizz Loaded?", "Ate That?", "Start Cooking?",
      "Glazing Hard?", "Touch Down?", "Ick Check?", "Big Facts?", "Unc Energy?",
      "Era Drop?", "Subtle Flex?", "Ion Know?", "W Drop?", "L Energy?",
      "Rizz Different?", "Era Alert?", "Stay Slaying?", "No Printer?", "Caught Vibing?",
      "Say Period?", "Fully Cooked?", "Ate Rn?", "Core Unlocked?", "Stay Locked?",
      "On Site?", "Pop Out?", "Understood, Gang?", "Understood, Champ?", "Understood, Homie?",
    ];
    return vibes[Math.floor(Math.random() * vibes.length)];
  }, [activeSessionId]);

  return (
    <div className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Collapsible Left Sidebar */}
        <div 
          className={`transition-all duration-300 ease-in-out border-r border-gray-800/80 bg-[#090d16]/95 backdrop-blur-md flex flex-col space-y-4 overflow-y-auto h-full flex-shrink-0 z-20 ${
            isSidebarOpen ? 'w-80 p-4 opacity-100' : 'w-0 p-0 border-r-0 overflow-hidden opacity-0 pointer-events-none'
          }`}
        >
          {isSidebarOpen && (
            <>
              {/* Workspace Scope Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Workspace Scope</span>
                  </label>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
                    title="Collapse Sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4 text-gray-400 hover:text-indigo-400" />
                  </button>
                </div>

                <div className="relative mb-3">
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white appearance-none cursor-pointer pr-8 font-medium"
                  >
                    <option value="all" className="bg-gray-900">📚 All Enrolled & Personal Notes</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">
                        🏫 {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 bottom-2.5 pointer-events-none" />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsSourcesModalOpen(true)}
                    className="flex-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 p-2.5 rounded-xl transition flex items-center justify-between text-xs font-bold shadow-md group"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Book className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition flex-shrink-0" />
                      <span className="truncate">Sources ({selectedDocIds.length}/{availableDocs.length})</span>
                    </div>
                    <span className="text-[10px] bg-indigo-900 border border-indigo-700 px-2 py-0.5 rounded-lg text-indigo-300 font-mono">
                      Manage
                    </span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Upload Study Material / Personal Notes"
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-md flex items-center justify-center flex-shrink-0 cursor-pointer"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
                    className="hidden"
                  />
                </div>

                {uploading && (
                  <div className="mt-2 text-[10px] text-indigo-300 font-mono flex items-center gap-1.5 animate-pulse bg-indigo-950/60 p-2 rounded-lg border border-indigo-800">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    <span>{uploadProgress}</span>
                  </div>
                )}
              </div>

              <hr className="border-gray-800/80 my-1" />

              {/* Saved Chat Threads */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Chat Threads</h3>
                  <button
                    onClick={handleCreateNewSession}
                    className="flex items-center space-x-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>

                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                  {chatSessions.length === 0 ? (
                    <p className="text-[11px] text-gray-500 py-3 text-center italic">
                      No saved chats yet.
                    </p>
                  ) : (
                    chatSessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            setActiveSessionId(session.id);
                            navigate(`/omnichat/${session.id}`);
                          }}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                            isActive
                              ? 'bg-gray-800 border-indigo-500 text-white font-bold shadow-sm'
                              : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                          }`}
                        >
                          <span className="truncate max-w-[150px]">{session.title}</span>
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="p-1 text-gray-500 hover:text-red-400 rounded transition"
                            title="Delete Chat Thread"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Main Studio Area */}
        <div className="flex-1 bg-[#090d16]/70 backdrop-blur-sm flex flex-col h-full min-h-0 overflow-hidden">
          {/* Studio Top Bar with Toggle Button */}
          <div className="p-3 border-b border-gray-800/80 bg-gray-950/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3">
              {/* Show Open button only when sidebar is collapsed */}
              {!isSidebarOpen && (
                <>
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition shadow-sm flex items-center justify-center cursor-pointer"
                    title="Open Workspace Scope"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
                  </button>
                  <div className="h-4 w-px bg-gray-800" />
                </>
              )}

              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-gray-200 truncate max-w-xs sm:max-w-md">{activeSession?.title}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCreateNewSession}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-[11px] text-gray-300 hover:text-white transition cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-400" />
                <span>New Chat</span>
              </button>

              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-[10px] text-indigo-300 font-mono shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>OmniChat Studio</span>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 font-sans text-xs">
            {/* Minimal Clean Welcome Empty State */}
            {isFreshSession ? (
              <div className="max-w-xl mx-auto py-16 sm:py-24 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="inline-flex p-3 sm:p-4 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-cyan-500/20 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                  {welcomeVibe}
                </h2>
              </div>
            ) : (
              /* Chat Messages List */
              activeSession?.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-3 ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <div className="p-2 bg-indigo-950 rounded-xl text-indigo-400 mt-0.5 border border-indigo-800 flex-shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg text-xs'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none text-xs shadow-inner'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                      <div className="overflow-x-auto text-xs leading-relaxed">
                        <MathRenderer content={msg.text} />
                      </div>
                    )}
                    {msg.provider && (
                      <span className="block text-[9px] text-slate-400 mt-2 font-mono border-t border-slate-700/50 pt-1.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span>{msg.provider}</span>
                      </span>
                    )}
                  </div>
                  {msg.sender === 'user' && (
                    <div className="p-2 bg-slate-800 rounded-xl text-slate-300 mt-0.5 border border-slate-700 flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex items-center space-x-2 text-indigo-400 bg-slate-900/60 p-3 rounded-xl border border-indigo-900/50 max-w-sm animate-in fade-in duration-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">Analyzing vector chunks & formulating answer...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Question Input Form */}
          <div className="p-3 sm:p-4 border-t border-gray-800/80 bg-gray-950/80 flex-shrink-0">
            <form onSubmit={handleSendQuestion} className="flex items-center space-x-2 max-w-4xl mx-auto">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder={
                  selectedDocIds.length > 0
                    ? `Ask anything from your ${selectedDocIds.length} active document(s)...`
                    : "Ask anything, solve derivations, ask doubts, or query study notes..."
                }
                disabled={sending}
                className="flex-1 glass-input rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputQuestion.trim() || sending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl transition font-semibold text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <span>Ask</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MANAGE SOURCES POP-UP MODAL */}
      {isSourcesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <Book className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Document Sources Management</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 shadow cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
                {availableDocs.length > 0 && (
                  <button
                    onClick={handleSelectAllSources}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-800 transition font-medium cursor-pointer"
                  >
                    {selectedDocIds.length === availableDocs.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={() => setIsSourcesModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-slate-950">
              {availableDocs.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-xs">No document notes uploaded yet.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-medium inline-flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload your first note</span>
                  </button>
                </div>
              ) : selectedClassroomId === 'all' ? (
                Object.entries(groupedDocsByClassroom()).map(([cName, docs]) => (
                  <div key={cName} className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold text-indigo-300 flex items-center space-x-2 pb-1 border-b border-slate-800">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{cName} ({docs.length} notes)</span>
                    </h4>

                    <div className="space-y-2 pt-1">
                      {docs.map((doc) => {
                        const isSelected = selectedDocIds.includes(doc.id);
                        return (
                          <div
                            key={doc.id}
                            className={`p-2.5 rounded-lg border transition flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-indigo-950/90 border-indigo-700 text-indigo-100'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div 
                              onClick={() => toggleDocSelection(doc.id)}
                              className="flex items-center space-x-2.5 truncate flex-1 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                              )}
                              <span className="truncate">{doc.filename}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1.5 pl-2 flex-shrink-0">
                              <button
                                onClick={(e) => handleOpenReader(doc, e)}
                                title="Read Document"
                                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {doc.uploaded_by_id === user?.id && (
                                <button
                                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                                  title="Delete personal document"
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  {availableDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-indigo-950/90 border-indigo-700 text-indigo-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div 
                          onClick={() => toggleDocSelection(doc.id)}
                          className="flex items-center space-x-3 truncate flex-1 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{doc.filename}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 pl-2 flex-shrink-0">
                          <button
                            onClick={(e) => handleOpenReader(doc, e)}
                            title="Read Document"
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {doc.uploaded_by_id === user?.id && (
                            <button
                              onClick={(e) => handleDeleteDocument(doc.id, e)}
                              title="Delete personal document"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setIsSourcesModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg cursor-pointer"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUILT-IN STUDIO DOCUMENT READER MODAL */}
      {readingDoc && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[100] animate-fade-in">
          <div className={`bg-slate-900 border border-indigo-900/80 rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
            isReaderFullscreen ? 'w-full h-full rounded-none' : 'max-w-5xl w-full h-[90vh]'
          }`}>
            {/* Reader Header */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <Book className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    {readingDoc.filename}
                  </h3>
                  <span className="text-[10px] text-indigo-400 uppercase font-mono">
                    OmniChat Document Reader
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {readingDoc.filename.toLowerCase().endsWith('.pdf') && (docDetails?.file_url && docDetails.file_url !== '/' && !docDetails.file_url.endsWith('/None')) && (
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[10px]">
                    <button
                      onClick={() => setReaderViewMode('pdf')}
                      className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                        readerViewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      PDF View
                    </button>
                    <button
                      onClick={() => setReaderViewMode('text')}
                      className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                        readerViewMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Text View
                    </button>
                  </div>
                )}

                {readerViewMode === 'text' && (
                  <div className="hidden sm:flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-slate-300">
                    <button
                      onClick={() => setReaderFontSize(f => Math.max(11, f - 1))}
                      className="p-1 hover:text-white cursor-pointer"
                      title="Decrease font size"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] px-1 font-mono">{readerFontSize}px</span>
                    <button
                      onClick={() => setReaderFontSize(f => Math.min(20, f + 1))}
                      className="p-1 hover:text-white cursor-pointer"
                      title="Increase font size"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAskAboutDoc}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask in Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  onClick={() => setIsReaderFullscreen(f => !f)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Toggle Fullscreen"
                >
                  {isReaderFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setReadingDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Close Reader"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Reader Body */}
            <div className="flex-1 min-h-0 bg-[#090d16] overflow-hidden flex flex-col">
              {loadingDocDetails ? (
                <div className="flex-1 flex items-center justify-center space-x-2 text-indigo-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-mono">Loading document content...</span>
                </div>
              ) : readerViewMode === 'pdf' && (readingDoc.file_url || readingDoc.file_path) ? (
                <iframe
                  src={readingDoc.file_url || `/${readingDoc.file_path.replace(/\\/g, '/')}`}
                  title="Document Preview"
                  className="w-full h-full border-none bg-slate-900"
                />
              ) : (
                <div 
                  className="flex-1 overflow-y-auto p-6 sm:p-8 font-sans leading-relaxed text-slate-200"
                  style={{ fontSize: `${readerFontSize}px` }}
                >
                  {docDetails?.content_text ? (
                    <div className="max-w-4xl mx-auto space-y-4">
                      <MathRenderer content={docDetails.content_text} />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No extracted text available for this document.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
