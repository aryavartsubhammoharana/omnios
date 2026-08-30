import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { 
  ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, 
  FileText, Download, Copy, Check, ZoomIn, ZoomOut, RotateCcw,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, 
  Moon, Sun, Coffee, Columns, AlignLeft, BookOpen, Layers,
  ExternalLink, GraduationCap, Clock, HelpCircle
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function QuickPDFReader() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  // Single Document Mode States
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [aiProvider, setAiProvider] = useState('groq');
  const [copied, setCopied] = useState(false);

  // Document Hub / Library Mode States (when no document_id in URL)
  const [availableDocs, setAvailableDocs] = useState([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [hubSearch, setHubSearch] = useState('');

  // Document Viewer Controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const [readerTheme, setReaderTheme] = useState('dark');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('paginated');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const viewerContainerRef = useRef(null);

  // AI Chat Assistant States
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Document AI Assistant. Ask me any doubt, formula derivation, or conceptual question directly from this document.'
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch single document if document_id is present
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

  // Fetch document library hub when no specific document_id is selected
  const fetchHubDocuments = async () => {
    setLoadingHub(true);
    try {
      const classRes = await API.get('/api/classroom/list');
      const classrooms = Array.isArray(classRes.data) ? classRes.data : [];
      
      const docPromises = classrooms.map(c => 
        API.get(`/api/classroom/${c.id}`)
          .then(res => {
            const docs = res.data?.documents || [];
            return docs.map(d => ({ ...d, classroom_name: c.name, classroom_id: c.id }));
          })
          .catch(() => [])
      );

      const nestedDocs = await Promise.all(docPromises);
      const flattened = nestedDocs.flat();
      setAvailableDocs(flattened);
    } catch (err) {
      console.error("Error fetching document hub", err);
    } finally {
      setLoadingHub(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchDoc();
    } else {
      setLoadingDoc(false);
      fetchHubDocuments();
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

  const docPages = useMemo(() => {
    if (!documentInfo?.content_text) return [];
    const text = documentInfo.content_text;
    
    if (text.includes('--- Page ')) {
      const parts = text.split(/(?=--- Page \d+)/i).filter(p => p.trim());
      if (parts.length > 0) return parts;
    }

    const paragraphs = text.split(/\n\s*\n/);
    const pages = [];
    let currentChunk = [];
    let currentLength = 0;
    const TARGET_PAGE_LENGTH = 1800;

    for (const para of paragraphs) {
      if (currentLength + para.length > TARGET_PAGE_LENGTH && currentChunk.length > 0) {
        pages.push(currentChunk.join('\n\n'));
        currentChunk = [para];
        currentLength = para.length;
      } else {
        currentChunk.push(para);
        currentLength += para.length;
      }
    }
    if (currentChunk.length > 0) {
      pages.push(currentChunk.join('\n\n'));
    }

    return pages.length > 0 ? pages : [text];
  }, [documentInfo?.content_text]);

  const totalPages = docPages.length || 1;

  const handleCopyText = () => {
    if (documentInfo?.content_text) {
      navigator.clipboard.writeText(documentInfo.content_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 160));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 70));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
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
    if (!inputQuestion.trim() || sending || isProcessing) return;

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

  // -------------------------------------------------------------
  // 1. NO DOCUMENT SELECTED: Render Document Hub & Notes Library
  // -------------------------------------------------------------
  if (!documentId) {
    const filteredDocs = availableDocs.filter(d => 
      (d.filename || '').toLowerCase().includes(hubSearch.toLowerCase()) ||
      (d.classroom_name || '').toLowerCase().includes(hubSearch.toLowerCase())
    );

    return (
      <div className="min-h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 p-4 sm:p-8 relative overflow-hidden select-none">
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
        <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

        <div className="max-w-6xl mx-auto space-y-6 relative z-10">
          {/* Header Card */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>AI Document Workspace</span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono">LaTeX Math + AI Doubt Solver</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Document & PDF Reader Hub
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
                Select any notes, textbook chapter, or assignment from your classrooms to read with distraction-free formatting, formulas rendering, and split-screen AI doubt solving.
              </p>
            </div>

            <Link
              to="/dashboard"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Go to Classrooms</span>
            </Link>
          </div>

          {/* Search Filter Bar */}
          <div className="flex items-center space-x-3 bg-gray-900/90 border border-gray-800/80 rounded-2xl p-2.5 shadow-inner">
            <Search className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
            <input
              type="text"
              value={hubSearch}
              onChange={(e) => setHubSearch(e.target.value)}
              placeholder="Search notes, chapters, or classrooms..."
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            {hubSearch && (
              <button
                onClick={() => setHubSearch('')}
                className="text-xs text-gray-400 hover:text-white px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Document Cards Grid */}
          {loadingHub ? (
            <div className="py-20 flex flex-col items-center justify-center text-indigo-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs text-gray-400">Loading your classroom documents...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="glass-card p-12 rounded-3xl border border-gray-800 text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-950/80 border border-indigo-700/50 rounded-2xl mx-auto flex items-center justify-center text-indigo-400 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No Documents Found</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  {hubSearch
                    ? "No documents matched your search filter. Try another keyword."
                    : "No study notes or PDFs have been uploaded in your enrolled classrooms yet."}
                </p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-indigo-300 border border-gray-700 text-xs font-semibold rounded-xl transition"
              >
                <span>Browse Classrooms</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const isDocx = (doc.filename || '').endsWith('.docx') || (doc.filename || '').endsWith('.doc');
                return (
                  <div
                    key={doc.id}
                    className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-xl border ${
                          isDocx 
                            ? 'bg-sky-950/80 text-sky-400 border-sky-800/60' 
                            : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
                        }`}>
                          {isDocx ? <FileText className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800">
                          {isDocx ? 'Word DOC' : 'PDF'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition line-clamp-2 leading-snug">
                          {doc.filename}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
                          Class: <span className="text-indigo-400 font-semibold">{doc.classroom_name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active Note'}
                      </span>
                      <Link
                        to={`/quick-reader?document_id=${doc.id}`}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                        <span>Read & Ask AI</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. SINGLE DOCUMENT MODE: Interactive 2-Column Reader + AI Chat
  // -------------------------------------------------------------
  if (loadingDoc) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-indigo-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Loading document...</p>
      </div>
    );
  }

  if (!documentInfo) {
    return (
      <div className="h-[calc(100vh-61px)] flex flex-col items-center justify-center bg-[#090d16] text-gray-400 space-y-3">
        <p className="text-sm font-semibold text-white">Document not found.</p>
        <Link to="/quick-reader" className="text-xs text-indigo-400 hover:underline">
          Return to Document Hub
        </Link>
      </div>
    );
  }

  const isProcessing = documentInfo.processing_status !== 'ready';
  const filename = documentInfo.filename || '';
  const isDocx = filename.endsWith('.docx') || filename.endsWith('.doc');

  let paperBg = 'bg-[#0f172a] text-gray-100 border-gray-800 shadow-2xl';
  let canvasBg = 'bg-[#090d16]';

  if (readerTheme === 'white') {
    paperBg = 'bg-[#ffffff] text-gray-900 border-gray-300 shadow-2xl';
    canvasBg = 'bg-[#e2e8f0]';
  } else if (readerTheme === 'sepia') {
    paperBg = 'bg-[#fbf0d9] text-[#433422] border-[#e6d5b8] shadow-2xl';
    canvasBg = 'bg-[#ede0c8]';
  }

  return (
    <div ref={viewerContainerRef} className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative select-text">
      {/* Top Main Navigation Header */}
      <header className="bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30 shadow-lg">
        <div className="flex items-center space-x-4">
          <Link to="/quick-reader" className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">All Documents</span>
          </Link>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center space-x-2.5">
            {isDocx ? (
              <div className="p-1.5 bg-sky-950/80 border border-sky-800/50 rounded-lg text-sky-400">
                <FileText className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 bg-indigo-950/80 border border-indigo-800/50 rounded-lg text-indigo-400">
                <Book className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white max-w-xs sm:max-w-md truncate leading-tight">
                {documentInfo.filename}
              </h1>
              <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                {isDocx ? 'Word DOC' : 'PDF Document'} • {totalPages} Pages
              </span>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded font-mono border hidden sm:inline ${
              isProcessing
                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {isProcessing ? 'Processing OCR...' : 'Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
            title="Copy Clean Document Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <a
            href={documentInfo.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs px-3 py-1.5 rounded-xl transition shadow"
            title="Download Original File"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Reader Body: 2 Columns (Document Viewer Left + AI Chat Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: DOCUMENT VIEWER */}
        <div className={`flex-1 flex flex-col overflow-hidden border-r border-gray-800/80 ${canvasBg}`}>
          {/* Viewer Toolbar */}
          <div className="bg-gray-900/90 border-b border-gray-800/80 px-4 py-2 flex items-center justify-between text-xs text-gray-300 z-20">
            {/* View Mode & Page Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'paginated' ? 'continuous' : 'paginated')}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                title={`Switch to ${viewMode === 'paginated' ? 'Continuous Scroll' : 'Paginated View'}`}
              >
                {viewMode === 'paginated' ? <Columns className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
              </button>

              {viewMode === 'paginated' && (
                <div className="flex items-center space-x-1 font-mono text-[11px]">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2">
                    Page <strong className="text-white">{currentPage}</strong> of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Theme & Zoom Controls */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setReaderTheme('dark')}
                  className={`p-1 rounded ${readerTheme === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                  title="Dark Theme"
                >
                  <Moon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setReaderTheme('sepia')}
                  className={`p-1 rounded ${readerTheme === 'sepia' ? 'bg-[#e6d5b8] text-[#433422]' : 'text-gray-400'}`}
                  title="Sepia Eye-Care Theme"
                >
                  <Coffee className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setReaderTheme('white')}
                  className={`p-1 rounded ${readerTheme === 'white' ? 'bg-white text-gray-900' : 'text-gray-400'}`}
                  title="White Paper Theme"
                >
                  <Sun className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center space-x-1 font-mono text-[11px]">
                <button onClick={handleZoomOut} className="p-1 rounded bg-gray-800 hover:bg-gray-700" title="Zoom Out">
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="w-10 text-center">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="p-1 rounded bg-gray-800 hover:bg-gray-700" title="Zoom In">
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Document Content Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center custom-scrollbar">
            <div
              style={{
                width: `${zoomLevel}%`,
                maxWidth: '900px',
                fontSize: `${fontSize}px`
              }}
              className={`p-6 sm:p-10 rounded-2xl transition-all ${paperBg}`}
            >
              {viewMode === 'paginated' ? (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-700/40 flex items-center justify-between text-[11px] opacity-70 font-mono">
                    <span>Page {currentPage} of {totalPages}</span>
                    <span>{documentInfo.filename}</span>
                  </div>
                  <div className="leading-relaxed font-serif prose prose-invert max-w-none">
                    <MathRenderer content={docPages[currentPage - 1] || 'No content on this page.'} />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {docPages.map((p, idx) => (
                    <div key={idx} className="space-y-3 pb-6 border-b border-gray-700/30 last:border-0">
                      <span className="text-[10px] font-mono opacity-50 block">--- Page {idx + 1} ---</span>
                      <div className="leading-relaxed font-serif prose prose-invert max-w-none">
                        <MathRenderer content={p} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live Context Synced
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
                <span className="font-mono text-[10px]">Analyzing document & generating explanation...</span>
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
              placeholder="Ask formula derivation, doubt, or summary..."
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
