import React, { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Bot, User, Trash2, Plus, CheckSquare, Square, FileText, Loader2, Book, ChevronDown, Filter, X, Layers, Send, Globe, Lock, Sparkles } from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function NotebookLMStudio() {
  const [searchParams] = useSearchParams();
  const initialClassroomId = searchParams.get('classroom_id');
  const { user } = useContext(AuthContext);

  // Classroom Filter State
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(initialClassroomId || 'all');

  // Documents Sources State
  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  const [aiProvider, setAiProvider] = useState('sarvam'); // Default to Sarvam AI for NotebookLM

  // Permanent Chat Threads State
  const [chatSessions, setChatSessions] = useState(() => {
    const saved = localStorage.getItem(`notebooklm_sessions_${user?.id || 'default'}`);
    return saved ? JSON.parse(saved) : [
      {
        id: 'session_1',
        title: 'General Doubt Solving Session',
        messages: [
          { sender: 'ai', text: 'Welcome to DLM Notebook! Click on "Sources" to manage document sources and ask grounded AI questions.' }
        ],
        createdAt: new Date().toISOString()
      }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState('session_1');
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // 1. Fetch Classrooms List for Dropdown
  useEffect(() => {
    API.get('/api/classroom/list')
      .then((res) => setClassrooms(res.data))
      .catch((err) => console.error("Error loading classrooms list", err));
  }, []);

  // 2. Fetch Document Sources based on selected classroom filter ('all' or specific ID)
  useEffect(() => {
    const url = (selectedClassroomId && selectedClassroomId !== 'all')
      ? `/api/upload/list?classroom_id=${selectedClassroomId}`
      : '/api/upload/list';

    API.get(url)
      .then((res) => {
        setAvailableDocs(res.data);
        if (res.data.length > 0) {
          setSelectedDocIds(res.data.map(d => d.id)); // All checked by default
        } else {
          setSelectedDocIds([]);
        }
      })
      .catch((err) => console.error("Error loading document sources", err));
  }, [selectedClassroomId]);

  useEffect(() => {
    localStorage.setItem(`notebooklm_sessions_${user?.id || 'default'}`, JSON.stringify(chatSessions));
  }, [chatSessions, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSessions, activeSessionId]);

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || chatSessions[0];

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
    const newSession = {
      id: `session_${Date.now()}`,
      title: `Study Session #${chatSessions.length + 1}`,
      messages: [
        { sender: 'ai', text: 'New doubt-solving session started. How can I help you today?' }
      ],
      createdAt: new Date().toISOString()
    };
    setChatSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (chatSessions.length <= 1) {
      alert("At least one active session must remain.");
      return;
    }
    const updated = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(updated);
    if (activeSessionId === sessionId) {
      setActiveSessionId(updated[0].id);
    }
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || sending) return;

    const userText = inputQuestion.trim();
    setInputQuestion('');

    // Append user message to active session
    setChatSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: [...s.messages, { sender: 'user', text: userText }]
        };
      }
      return s;
    }));

    setSending(true);

    try {
      // Only pass document_id if EXACTLY 1 document was specifically chosen by the user
      // Otherwise, pass classroom_id (for Classroom Vector DB) or null (for Global Anonymous Vector DB)
      const singleDocId = (selectedDocIds.length === 1) ? selectedDocIds[0] : null;
      const cId = (selectedClassroomId && selectedClassroomId !== 'all') ? parseInt(selectedClassroomId) : null;

      const res = await API.post('/api/ai/chat', {
        question: userText,
        document_id: singleDocId,
        classroom_id: cId,
        ai_provider: aiProvider
      });

      setChatSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
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
        if (s.id === activeSessionId) {
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

  // Group documents by classroom for "All Classrooms" modal view
  const groupedDocsByClassroom = () => {
    const map = {};
    availableDocs.forEach((doc) => {
      const cName = classrooms.find(c => c.id === doc.classroom_id)?.name || 'Classroom Notes';
      if (!map[cName]) map[cName] = [];
      map[cName].push(doc);
    });
    return map;
  };

  return (
    <div className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      {/* Main Studio Grid (Flex 1, Overflow Hidden) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar (3 Cols): Classroom Dropdown & Sources Pop-up Button */}
        <div className="lg:col-span-3 border-r border-gray-800/80 bg-[#090d16]/90 backdrop-blur-md p-4 flex flex-col space-y-5 overflow-y-auto h-full">
          {/* Classroom Selector Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Classroom Filter</span>
            </label>

            <div className="relative mb-3">
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white appearance-none cursor-pointer pr-8 font-medium"
              >
                <option value="all" className="bg-gray-900">📚 All My Enrolled Classrooms</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">
                    🏫 {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 bottom-2.5 pointer-events-none" />
            </div>

            {/* Clickable Sources Button with Dynamic Count */}
            <button
              onClick={() => setIsSourcesModalOpen(true)}
              className="w-full bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 p-3 rounded-xl transition flex items-center justify-between text-xs font-bold shadow-md group"
            >
              <div className="flex items-center space-x-2">
                <Book className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
                <span>Sources ({selectedDocIds.length}/{availableDocs.length})</span>
              </div>
              <span className="text-[10px] bg-indigo-900 border border-indigo-700 px-2 py-0.5 rounded-lg text-indigo-300 font-mono">
                Manage
              </span>
            </button>
          </div>

          <hr className="border-gray-800/80" />

          {/* Saved Chat History Threads */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Chat Threads</h3>
              <button
                onClick={handleCreateNewSession}
                className="flex items-center space-x-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition shadow-sm"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {chatSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                      isActive
                        ? 'bg-gray-800 border-indigo-500 text-white font-bold shadow-sm'
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                    }`}
                  >
                    <span className="truncate max-w-[150px]">{session.title}</span>
                    {chatSessions.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1 text-gray-500 hover:text-red-400 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Main Studio Area (9 Cols): Grounded AI Chat */}
        <div className="lg:col-span-9 bg-[#090d16]/70 backdrop-blur-sm flex flex-col h-full min-h-0 overflow-hidden">
          {/* Studio Active Session Top Bar (Flex Shrink 0) */}
          <div className="p-3 border-b border-gray-800/80 bg-gray-950/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-gray-200">{activeSession?.title}</span>
              
              {/* Dual Vector DB Scope Badge */}
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border bg-slate-900">
                {selectedClassroomId === 'all' ? (
                  <>
                    <Globe className="w-3 h-3 text-sky-400" />
                    <span className="text-sky-300">Global Vector DB (Anonymous)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Classroom Vector DB (Private)</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-[10px] text-indigo-300 font-mono shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>DLM Studio AI</span>
              </div>
            </div>
          </div>

          {/* Chat Thread Messages List (Flex 1, Overflow Y Auto) */}
          <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-4 font-sans text-xs">
            {activeSession?.messages.map((msg, idx) => (
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
            ))}
            {sending && (
              <div className="flex items-center space-x-2 text-indigo-400 text-xs py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>DLM Notebook AI is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form (Flex Shrink 0 - Always Pinned to Bottom!) */}
          <form onSubmit={handleSendQuestion} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center space-x-3 flex-shrink-0">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask any grounded doubt or question across your selected sources..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !inputQuestion.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* POP-UP SOURCES PICKER MODAL (Square Window Box with Checkboxes) */}
      {isSourcesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Book className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Document Sources Manager</h3>
                  <p className="text-[10px] text-slate-400">
                    Selected <span className="text-indigo-400 font-bold">{selectedDocIds.length}</span> of {availableDocs.length} PDF notes
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {availableDocs.length > 0 && (
                  <button
                    onClick={handleSelectAllSources}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-800 transition font-medium"
                  >
                    {selectedDocIds.length === availableDocs.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={() => setIsSourcesModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Checkbox List (Grouped by Classroom for "All Classrooms") */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5 bg-slate-950">
              {availableDocs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No document notes uploaded in this classroom filter.
                </div>
              ) : selectedClassroomId === 'all' ? (
                /* Grouped by Classroom for "All Classrooms" mode */
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
                            onClick={() => toggleDocSelection(doc.id)}
                            className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-indigo-950/90 border-indigo-700 text-indigo-100 font-medium'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                              )}
                              <span className="truncate">{doc.filename}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {isSelected ? 'Included' : 'Excluded'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                /* Single Classroom Checklist */
                <div className="space-y-2">
                  {availableDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-indigo-950/90 border-indigo-700 text-indigo-100 font-medium'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 truncate">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{doc.filename}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {isSelected ? 'Included' : 'Excluded'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setIsSourcesModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
