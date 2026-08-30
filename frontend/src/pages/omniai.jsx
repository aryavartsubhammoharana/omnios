import React, { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { 
  Bot, User, Trash2, Plus, CheckSquare, Square, FileText, Loader2, Book, 
  ChevronDown, Filter, X, Layers, Send, Globe, Lock, Sparkles, Eye, Upload, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, ArrowRight
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function OmniAI() {
  const [searchParams] = useSearchParams();
  const initialClassroomId = searchParams.get('classroom_id');
  const { user } = useContext(AuthContext);

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(initialClassroomId || 'all');

  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  const [readingDoc, setReadingDoc] = useState(null);
  const [docDetails, setDocDetails] = useState(null);
  const [loadingDocDetails, setLoadingDocDetails] = useState(false);
  const [readerViewMode, setReaderViewMode] = useState('pdf');
  const [readerFontSize, setReaderFontSize] = useState(14);
  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);

  const [chatSessions, setChatSessions] = useState(() => {
    const saved = localStorage.getItem(`notebooklm_sessions_${user?.id || 'default'}`);
    return saved ? JSON.parse(saved) : [
      {
        id: 'session_1',
        title: 'General Doubt Solving Session',
        messages: [
          { sender: 'ai', text: 'Welcome to OmniAI! Click on "Sources" to manage documents, read them in the built-in reader, or upload new study notes.' }
        ],
        createdAt: new Date().toISOString()
      }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState('session_1');
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

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

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(`Uploading ${files.length} document(s)...`);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    if (selectedClassroomId && selectedClassroomId !== 'all') {
      formData.append('classroom_id', selectedClassroomId);
      formData.append('folder_name', 'Classroom Notes');
    } else {
      formData.append('folder_name', 'Personal Notes');
    }

    try {
      const res = await API.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadProgress('Extraction complete! Indexing to Vector DB...');
      setTimeout(() => {
        fetchSources();
        setUploading(false);
        setUploadProgress('');
      }, 1200);
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.detail || "Failed to upload document.");
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleOpenReader = async (doc, e) => {
    if (e) e.stopPropagation();
    setReadingDoc(doc);
    setLoadingDocDetails(true);
    try {
      const res = await API.get(`/api/upload/document/${doc.id}`);
      setDocDetails(res.data);
      const hasPhysicalFile = res.data?.file_url && res.data.file_url !== '/' && !res.data.file_url.endsWith('/None');
      if (doc.filename.toLowerCase().endsWith('.pdf') && hasPhysicalFile) {
        setReaderViewMode('pdf');
      } else {
        setReaderViewMode('text');
      }
    } catch (err) {
      console.error("Error loading document text", err);
    } finally {
      setLoadingDocDetails(false);
    }
  };

  useEffect(() => {
    if (!readingDoc || docDetails?.processing_status === 'ready') return;

    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/api/upload/document/${readingDoc.id}`);
        if (res.data) {
          setDocDetails(res.data);
          if (res.data.processing_status === 'ready') {
            fetchSources();
          }
        }
      } catch (err) {
        console.error("Silent document refresh error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [readingDoc, docDetails?.processing_status]);

  const handleDeleteDocument = async (docId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this personal document?")) return;
    try {
      await API.delete(`/api/upload/document/${docId}`);
      fetchSources();
      if (readingDoc?.id === docId) {
        setReadingDoc(null);
      }
    } catch (err) {
      console.error("Delete document error:", err);
      alert(err.response?.data?.detail || "Could not delete document.");
    }
  };

  const handleAskAboutDoc = () => {
    if (!readingDoc) return;
    setInputQuestion(`Explain the key concepts and formulas from "${readingDoc.filename}"`);
    setReadingDoc(null);
    setIsSourcesModalOpen(false);
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || sending) return;

    const userText = inputQuestion.trim();
    setInputQuestion('');

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
      const singleDocId = (selectedDocIds.length === 1) ? selectedDocIds[0] : null;
      const cId = (selectedClassroomId && selectedClassroomId !== 'all') ? parseInt(selectedClassroomId) : null;

      const res = await API.post('/api/ai/chat', {
        question: userText,
        document_id: singleDocId,
        classroom_id: cId,
        ai_provider: 'sarvam'
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

  return (
    <div className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar (3 Cols) */}
        <div className="lg:col-span-3 border-r border-gray-800/80 bg-[#090d16]/90 backdrop-blur-md p-4 flex flex-col space-y-4 overflow-y-auto h-full">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Workspace Scope</span>
            </label>

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
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-md flex items-center justify-center flex-shrink-0"
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

          <hr className="border-gray-800/80" />

          {/* Quick Active Documents List with Read Eye Icon */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active Documents</h3>
              <span className="text-[10px] text-indigo-400 font-mono">{availableDocs.filter(d => selectedDocIds.includes(d.id)).length} Active</span>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {availableDocs.filter(d => selectedDocIds.includes(d.id)).length === 0 ? (
                <p className="text-[11px] text-gray-500 py-1 italic">No active documents chosen.</p>
              ) : (
                availableDocs.filter(d => selectedDocIds.includes(d.id)).map(doc => (
                  <div
                    key={doc.id}
                    className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300 group hover:border-slate-700"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{doc.filename}</span>
                    </div>
                    <button
                      onClick={(e) => handleOpenReader(doc, e)}
                      title="Read Document in Studio Reader"
                      className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-indigo-950 rounded transition flex items-center gap-1 text-[10px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
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

        {/* Right Main Studio Area (9 Cols) */}
        <div className="lg:col-span-9 bg-[#090d16]/70 backdrop-blur-sm flex flex-col h-full min-h-0 overflow-hidden">
          {/* Studio Top Bar */}
          <div className="p-3 border-b border-gray-800/80 bg-gray-950/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-gray-200">{activeSession?.title}</span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-[10px] text-indigo-300 font-mono shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>OmniAI Studio</span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
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
              <div className="flex items-center space-x-2 text-indigo-400 bg-slate-900/60 p-3 rounded-xl border border-indigo-900/50 max-w-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">Analyzing vector chunks & formulating answer...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Question Input Form */}
          <div className="p-4 border-t border-gray-800/80 bg-gray-950/80 flex-shrink-0">
            <form onSubmit={handleSendQuestion} className="flex items-center space-x-2">
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
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
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

            <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-slate-950">
              {availableDocs.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-xs">No document notes uploaded yet.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-medium inline-flex items-center gap-1.5 shadow"
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
                                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {doc.uploaded_by_id === user?.id && (
                                <button
                                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                                  title="Delete personal document"
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
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
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {doc.uploaded_by_id === user?.id && (
                            <button
                              onClick={(e) => handleDeleteDocument(doc.id, e)}
                              title="Delete personal document"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
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
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg"
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
                    OmniAI Document Reader
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {readingDoc.filename.toLowerCase().endsWith('.pdf') && (docDetails?.file_url && docDetails.file_url !== '/' && !docDetails.file_url.endsWith('/None')) && (
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[10px]">
                    <button
                      onClick={() => setReaderViewMode('pdf')}
                      className={`px-2.5 py-1 rounded font-semibold transition ${
                        readerViewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      PDF View
                    </button>
                    <button
                      onClick={() => setReaderViewMode('text')}
                      className={`px-2.5 py-1 rounded font-semibold transition ${
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
                      className="p-1 hover:text-white"
                      title="Decrease font size"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] px-1 font-mono">{readerFontSize}px</span>
                    <button
                      onClick={() => setReaderFontSize(f => Math.min(20, f + 1))}
                      className="p-1 hover:text-white"
                      title="Increase font size"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAskAboutDoc}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask in Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  onClick={() => setIsReaderFullscreen(f => !f)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="Toggle Fullscreen"
                >
                  {isReaderFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setReadingDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
