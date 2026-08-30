import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { 
  ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, 
  FileText, Download, Copy, Check, Search, 
  Columns, AlignLeft, GraduationCap, Code2, Zap, FolderOpen,
  Maximize2, Minimize2, ExternalLink
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function QuickPDFReader() {
  const [searchParams, setSearchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  // Hub States
  const [activeTab, setActiveTab] = useState('classroom'); // 'classroom' | 'developer'
  const [classroomDocs, setClassroomDocs] = useState([]);
  const [developerDocs, setDeveloperDocs] = useState([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [hubSearch, setHubSearch] = useState('');

  // Single Document Mode States
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' (Real PDF default) | 'text' (Extracted AI Text)
  const [aiProvider, setAiProvider] = useState('groq');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerContainerRef = useRef(null);

  // AI Chat Assistant States
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Classroom AI Assistant. Ask me any doubt, formula derivation, or question directly from this PDF.'
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch single document via API
  const fetchDoc = async () => {
    if (!documentId) {
      setLoadingDoc(false);
      return;
    }
    setLoadingDoc(true);

    try {
      const res = await API.get(`/api/upload/document/${documentId}`);
      setDocumentInfo(res.data);
      API.post('/api/analytics/track-view', null, { params: { document_id: documentId, time_spent_seconds: 60 } }).catch(() => {});
    } catch (err) {
      console.error("Error loading document", err);
    } finally {
      setLoadingDoc(false);
    }
  };

  // Fetch classroom documents (Section 1) and developer documents (Section 2)
  const fetchAllDocuments = async () => {
    setLoadingHub(true);
    try {
      // 1. Fetch Classroom Documents using unified /api/upload/list endpoint
      const docsRes = await API.get('/api/upload/list').catch(() => ({ data: [] }));
      const allDocs = Array.isArray(docsRes.data) ? docsRes.data : [];
      
      // Filter strictly for classroom PDF files only
      const pdfs = allDocs.filter(d => (d.filename || '').toLowerCase().endsWith('.pdf'));
      setClassroomDocs(pdfs);

      // 2. Fetch Developer Documents dynamically from backend
      const devRes = await API.get('/api/upload/developer-docs').catch(() => ({ data: [] }));
      const devDocs = Array.isArray(devRes.data) ? devRes.data : [];
      const devPdfs = devDocs.filter(d => (d.filename || '').toLowerCase().endsWith('.pdf'));
      setDeveloperDocs(devPdfs);
    } catch (err) {
      console.error("Error fetching documents", err);
    } finally {
      setLoadingHub(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchDoc();
    } else {
      setLoadingDoc(false);
      fetchAllDocuments();
    }
  }, [documentId]);

  useEffect(() => {
    if (!documentInfo || documentInfo.processing_status === 'ready') return;
    const interval = setInterval(() => {
      fetchDoc();
    }, 2500);
    return () => clearInterval(interval);
  }, [documentInfo?.processing_status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyText = () => {
    if (documentInfo?.content_text) {
      navigator.clipboard.writeText(documentInfo.content_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || sending) return;

    const userText = inputQuestion.trim();
    setInputQuestion('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setSending(true);

    try {
      const res = await API.post('/api/ai/chat', {
        question: userText,
        document_id: parseInt(documentId),
        ai_provider: aiProvider
      });
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: res.data.answer, provider: res.data.provider_used }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: 'Sorry, I encountered an error answering your question.' }
      ]);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. NO DOCUMENT SELECTED: Render Classroom PDFs & Developer Library Hub
  // ─────────────────────────────────────────────────────────────
  if (!documentId) {
    const filteredClassroomDocs = classroomDocs.filter(d => 
      (d.filename || '').toLowerCase().includes(hubSearch.toLowerCase()) ||
      (d.classroom_name || '').toLowerCase().includes(hubSearch.toLowerCase())
    );

    const filteredDevDocs = developerDocs.filter(d =>
      (d.filename || '').toLowerCase().includes(hubSearch.toLowerCase()) ||
      (d.folder_name || '').toLowerCase().includes(hubSearch.toLowerCase())
    );

    return (
      <div className="min-h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 p-4 sm:p-8 relative overflow-hidden select-none">
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
        <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

        <div className="max-w-6xl mx-auto space-y-6 relative z-10">
          {/* Search Bar + Section Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-gray-900/90 border border-gray-800 p-1 rounded-2xl shadow-inner text-xs font-medium shrink-0">
              <button
                onClick={() => setActiveTab('classroom')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'classroom' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Classroom PDFs ({classroomDocs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('developer')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'developer' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Developer Library ({developerDocs.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="flex-1 max-w-md flex items-center space-x-2 bg-gray-900/90 border border-gray-800/80 rounded-2xl px-3 py-2 shadow-inner">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search notes, chapters, PDF documents..."
                className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              {hubSearch && (
                <button onClick={() => setHubSearch('')} className="text-xs text-gray-400 hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 1: CLASSROOM PDFS & STUDY MATERIALS
              ══════════════════════════════════════════════════════ */}
          {activeTab === 'classroom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/60 text-sky-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Section 1: Classroom PDFs
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Official lecture PDFs and notes uploaded in your enrolled classrooms
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  {filteredClassroomDocs.length} PDFs
                </span>
              </div>

              {loadingHub ? (
                <div className="py-12 flex flex-col items-center justify-center text-indigo-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-xs text-gray-400">Loading classroom PDFs...</p>
                </div>
              ) : filteredClassroomDocs.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border border-gray-800/80 text-center space-y-3">
                  <FileText className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">
                    {hubSearch ? 'No classroom PDFs match your search.' : 'No PDFs uploaded in your classrooms yet.'}
                  </p>
                  <Link to="/dashboard" className="inline-block text-xs text-indigo-400 hover:underline">
                    Go to Classrooms to upload or view notes
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClassroomDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 transition flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="p-2.5 rounded-xl border bg-indigo-950/80 text-indigo-400 border-indigo-800/60">
                            <Book className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">
                            {doc.classroom_name || 'Classroom'}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition line-clamp-2 leading-snug">
                            {doc.filename}
                          </h3>
                          <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
                            Folder: <span className="text-indigo-400 font-semibold">{doc.folder_name || 'General Notes'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active Note'}
                        </span>
                        <Link
                          to={`/quick-reader?document_id=${doc.id}`}
                          className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" />
                          <span>Read & Ask AI</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SECTION 2: OTHER PDFS & REFERENCE DOCUMENTS BY DEVELOPER
              ══════════════════════════════════════════════════════ */}
          {activeTab === 'developer' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Section 2: Other PDFs by Developer</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                        Developer Library
                      </span>
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      Official reference documents, guides, and handbooks published by the developer
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {filteredDevDocs.length} Documents
                </span>
              </div>

              {loadingHub ? (
                <div className="py-12 flex flex-col items-center justify-center text-amber-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-xs text-gray-400">Loading developer documents...</p>
                </div>
              ) : filteredDevDocs.length === 0 ? (
                <div className="glass-card p-8 rounded-2xl border border-gray-800/80 text-center space-y-3 bg-gray-950/60">
                  <FolderOpen className="w-8 h-8 text-amber-500/40 mx-auto" />
                  <h3 className="text-xs font-bold text-gray-300">No Developer PDFs Uploaded Yet</h3>
                  <p className="text-[11px] text-gray-500 max-w-md mx-auto leading-relaxed">
                    Official reference handbooks, formula sheets, and PDF documentation published by the system developer will appear here dynamically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDevDocs.map((dev) => (
                    <div
                      key={dev.id}
                      className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition flex flex-col justify-between space-y-4 group bg-gray-950/80"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>{dev.folder_name || 'Developer Doc'}</span>
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition line-clamp-2 leading-snug">
                            {dev.filename}
                          </h3>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {dev.created_at ? new Date(dev.created_at).toLocaleDateString() : 'Official'}
                        </span>
                        <Link
                          to={`/quick-reader?document_id=${dev.id}`}
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:text-white" />
                          <span>Read & Ask AI</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. SINGLE DOCUMENT MODE: Real PDF Embed Reader + AI Copilot
  // ─────────────────────────────────────────────────────────────
  if (loadingDoc) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-indigo-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Loading PDF document...</p>
      </div>
    );
  }

  if (!documentInfo) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-gray-400 space-y-3">
        <p className="text-sm font-semibold text-white">PDF Document not found.</p>
        <Link to="/quick-reader" className="text-xs text-indigo-400 hover:underline">
          Return to Document Hub
        </Link>
      </div>
    );
  }

  const isProcessing = documentInfo.processing_status !== 'ready';
  const pdfUrl = documentInfo.file_url 
    ? `${documentInfo.file_url}#toolbar=1&navpanes=1&scrollbar=1` 
    : `/api/upload/raw/${documentInfo.id}#toolbar=1&navpanes=1&scrollbar=1`;

  return (
    <div ref={viewerContainerRef} className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative select-text">
      {/* Top Main Navigation Header */}
      <header className="bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30 shadow-lg">
        <div className="flex items-center space-x-4">
          <Link to="/quick-reader" className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">All Documents Hub</span>
          </Link>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg border bg-indigo-950/80 border-indigo-800/50 text-indigo-400">
              <Book className="w-4 h-4" />
            </div>

            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white max-w-xs sm:max-w-md truncate leading-tight">
                {documentInfo.filename}
              </h1>
              <span className="text-[10px] text-indigo-400 font-mono hidden sm:inline">
                Actual PDF Document Viewer
              </span>
            </div>

            <span className={`text-[9px] px-2 py-0.5 rounded font-mono border hidden sm:inline ${
              isProcessing
                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {isProcessing ? 'AI Syncing...' : 'AI Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* View Mode Toggle (Real PDF vs AI Extracted Text) */}
          <div className="flex bg-gray-900 p-0.5 rounded-xl border border-gray-800">
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'pdf' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Real PDF
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
              title="View OCR Extracted Text for AI"
            >
              Extracted Text
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {documentInfo.file_url && (
            <a
              href={documentInfo.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs px-3 py-1.5 rounded-xl transition shadow"
              title="Download Original PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </header>

      {/* Reader Body: 2 Columns (Actual Embedded PDF Left + AI Copilot Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: ACTUAL EMBEDDED PDF VIEWER */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-800/80 bg-[#090d16]">
          {viewMode === 'pdf' ? (
            <div className="w-full h-full p-2 bg-[#090d16] flex flex-col">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0 rounded-2xl bg-slate-900 shadow-2xl"
                title={documentInfo.filename}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 font-sans leading-relaxed text-gray-200 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-2xl text-xs text-indigo-300 flex items-center justify-between">
                  <span>📄 This is the OCR-extracted text index used behind the scenes by OmniOS AI Copilot.</span>
                  <button
                    onClick={handleCopyText}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold text-[10px] flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="bg-gray-900/90 p-8 rounded-2xl border border-gray-800 shadow-inner max-w-none text-sm">
                  <MathRenderer content={documentInfo.content_text || 'No text extracted yet.'} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI COPILOT DOUBT SOLVER */}
        <div className="w-full lg:w-96 bg-[#0c101a] flex flex-col justify-between border-t lg:border-t-0 border-gray-800 z-10 flex-shrink-0">
          {/* AI Header */}
          <div className="p-3.5 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-purple-950/80 text-purple-400 rounded-lg border border-purple-800/60 shadow">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Document AI Assistant</span>
                <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live PDF Context
                </span>
              </div>
            </div>

            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-[10px] text-gray-300 rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="groq">Groq LLaMA 3.3</option>
              <option value="gemini">Google Gemini</option>
              <option value="sarvam">Sarvam AI (Hindi/Regional)</option>
            </select>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div className={`p-1.5 rounded-lg text-xs flex-shrink-0 ${
                  m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-purple-950 text-purple-400 border border-purple-800/60'
                }`}>
                  {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-900/90 text-gray-200 border border-gray-800/80 shadow-inner'
                }`}>
                  <MathRenderer content={m.text} />
                  {m.provider && (
                    <span className="block text-[9px] text-gray-500 font-mono mt-1 text-right">
                      via {m.provider}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center space-x-2 text-xs text-indigo-400 p-2 bg-gray-900/60 rounded-xl w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[10px]">Analyzing PDF & answering question...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendQuestion} className="p-3 bg-gray-950/80 border-t border-gray-800 flex items-center space-x-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask formula derivation, doubt, or summary from PDF..."
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
            <button
              type="submit"
              disabled={sending || !inputQuestion.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition flex-shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
