import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { 
  ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, 
  FileText, Download, Copy, Check, ZoomIn, ZoomOut, RotateCcw,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, 
  Moon, Sun, Coffee, Columns, AlignLeft
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function QuickPDFReader() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [aiProvider, setAiProvider] = useState('groq');
  const [copied, setCopied] = useState(false);

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

  // Ephemeral AI Chat
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Document AI Assistant. Ask me any doubt, formula derivation, or conceptual question directly from this document.'
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  const fetchDoc = async () => {
    if (!documentId) return;
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

  useEffect(() => {
    fetchDoc();
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

  if (loadingDoc) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#090d16] text-indigo-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!documentInfo) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#090d16] text-gray-400">
        <p>Document not found.</p>
        <Link to="/dashboard" className="mt-4 text-indigo-400 hover:underline text-xs">Return to Dashboard</Link>
      </div>
    );
  }

  const isProcessing = documentInfo.processing_status !== 'ready';
  const filename = documentInfo.filename || '';
  const isDocx = filename.endsWith('.docx') || filename.endsWith('.doc');
  const isPdf = filename.endsWith('.pdf');

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
          <Link to={`/classroom/${documentInfo.classroom_id || ''}`} className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Classroom</span>
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
                {isDocx ? 'Docx Smooth Shower' : 'PDF Viewer'} • {totalPages} Pages
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
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition"
            title="Copy Clean Document Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <a
            href={documentInfo.file_url}
            download={documentInfo.filename}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition"
            title="Download Original File"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>

          <Link
            to={`/notebooklm?classroom_id=${documentInfo.classroom_id || ''}`}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studio</span>
          </Link>
        </div>
      </header>

      {/* Main Split Screen: Left (Document Shower) & Right (Ephemeral AI Doubt Solver) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Document Shower Column */}
        <div className={`lg:col-span-7 border-r border-gray-800/80 ${canvasBg} h-full overflow-hidden flex flex-col transition-colors duration-300`}>
          {isPdf ? (
            <iframe
              src={documentInfo.file_url}
              className="w-full h-full border-0 bg-white"
              title={documentInfo.filename}
            />
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Professional Floating Document Toolbar */}
              <div className="bg-gray-950/90 backdrop-blur-md border-b border-gray-800/80 px-4 py-2 flex items-center justify-between gap-2 z-20 flex-shrink-0 text-xs shadow-sm">
                {/* Page Navigation & Count */}
                <div className="flex items-center space-x-1.5">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="p-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-40 transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-0.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 font-mono text-[11px]">
                    Page <span className="font-bold text-indigo-400">{currentPage}</span> / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="p-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-40 transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="h-4 w-px bg-gray-800 mx-1 hidden sm:block" />

                  {/* View Mode Toggle */}
                  <div className="hidden sm:flex bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[10px]">
                    <button
                      onClick={() => setViewMode('paginated')}
                      className={`px-2 py-0.5 rounded font-semibold transition ${
                        viewMode === 'paginated' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Single Page
                    </button>
                    <button
                      onClick={() => setViewMode('continuous')}
                      className={`px-2 py-0.5 rounded font-semibold transition ${
                        viewMode === 'continuous' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Continuous
                    </button>
                  </div>
                </div>

                {/* Center / Zoom & Search Controls */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                    <button
                      onClick={handleZoomOut}
                      className="p-1 text-gray-400 hover:text-white transition"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-gray-300 px-1.5 font-bold">
                      {zoomLevel}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="p-1 text-gray-400 hover:text-white transition"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-1 text-gray-400 hover:text-white border-l border-gray-800 transition"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Font Size Adjust */}
                  <div className="hidden md:flex items-center bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 space-x-1 text-[10px] text-gray-300">
                    <span className="text-gray-500">Font:</span>
                    <button onClick={() => setFontSize(prev => Math.max(prev - 1, 11))} className="hover:text-white px-1">A-</button>
                    <span className="font-mono text-indigo-300 font-bold">{fontSize}px</span>
                    <button onClick={() => setFontSize(prev => Math.min(prev + 1, 20))} className="hover:text-white px-1">A+</button>
                  </div>
                </div>

                {/* Theme Selector & Fullscreen */}
                <div className="flex items-center space-x-1.5">
                  <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[10px]">
                    <button
                      onClick={() => setReaderTheme('dark')}
                      className={`p-1 rounded ${readerTheme === 'dark' ? 'bg-gray-800 text-indigo-300' : 'text-gray-400'}`}
                      title="Dark Mode"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReaderTheme('white')}
                      className={`p-1 rounded ${readerTheme === 'white' ? 'bg-gray-200 text-gray-900' : 'text-gray-400'}`}
                      title="Paper White"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReaderTheme('sepia')}
                      className={`p-1 rounded ${readerTheme === 'sepia' ? 'bg-[#e6d5b8] text-[#433422]' : 'text-gray-400'}`}
                      title="Sepia Warm"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white rounded-lg transition"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Reading Mode"}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Document Pages Shower Canvas with Smooth Scrolling */}
              <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 scroll-smooth flex flex-col items-center space-y-8">
                {viewMode === 'paginated' ? (
                  /* Single A4 Page Shower */
                  <div 
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', fontSize: `${fontSize}px` }}
                    className={`w-full max-w-[800px] min-h-[1050px] p-8 sm:p-14 rounded-2xl border transition-all duration-300 ease-out relative flex flex-col justify-between ${paperBg}`}
                  >
                    <div>
                      {/* Page Header */}
                      <div className="border-b border-current/10 pb-3 mb-6 flex items-center justify-between text-[11px] font-mono opacity-60">
                        <span className="truncate max-w-[300px]">{documentInfo.filename}</span>
                        <span>Page {currentPage} of {totalPages}</span>
                      </div>

                      {/* Page Content */}
                      <div className="prose max-w-none leading-relaxed transition-all duration-200">
                        <MathRenderer content={docPages[currentPage - 1] || 'No content on this page.'} />
                      </div>
                    </div>

                    {/* Page Footer */}
                    <div className="border-t border-current/10 pt-3 mt-10 flex items-center justify-between text-[10px] font-mono opacity-50">
                      <span>NoteAI Document Shower</span>
                      <span>— {currentPage} —</span>
                    </div>
                  </div>
                ) : (
                  /* Continuous Multi-Page Shower */
                  docPages.map((pageText, idx) => (
                    <div 
                      key={idx}
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', fontSize: `${fontSize}px` }}
                      className={`w-full max-w-[800px] min-h-[1050px] p-8 sm:p-14 rounded-2xl border transition-all duration-300 ease-out relative flex flex-col justify-between mb-8 ${paperBg}`}
                    >
                      <div>
                        {/* Page Header */}
                        <div className="border-b border-current/10 pb-3 mb-6 flex items-center justify-between text-[11px] font-mono opacity-60">
                          <span className="truncate max-w-[300px]">{documentInfo.filename}</span>
                          <span>Page {idx + 1} of {totalPages}</span>
                        </div>

                        {/* Page Content */}
                        <div className="prose max-w-none leading-relaxed transition-all duration-200">
                          <MathRenderer content={pageText} />
                        </div>
                      </div>

                      {/* Page Footer */}
                      <div className="border-t border-current/10 pt-3 mt-10 flex items-center justify-between text-[10px] font-mono opacity-50">
                        <span>NoteAI Document Shower</span>
                        <span>— {idx + 1} —</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Ephemeral AI Doubt Solving Chat */}
        <div className="lg:col-span-5 bg-[#090d16]/95 backdrop-blur-md flex flex-col h-full min-h-0 overflow-hidden">
          <div className="p-3 border-b border-gray-800/80 bg-gray-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-gray-200">Ephemeral Doubt Solving</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-400 font-mono">Engine:</span>
              <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[10px]">
                <button
                  onClick={() => setAiProvider('groq')}
                  className={`px-2 py-0.5 rounded font-semibold transition ${
                    aiProvider === 'groq' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Groq 120B ⚡
                </button>
                <button
                  onClick={() => setAiProvider('sarvam')}
                  className={`px-2 py-0.5 rounded font-semibold transition ${
                    aiProvider === 'sarvam' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sarvam
                </button>
                <button
                  onClick={() => setAiProvider('gemini')}
                  className={`px-2 py-0.5 rounded font-semibold transition ${
                    aiProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Gemini
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 font-sans text-xs scroll-smooth">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="p-1.5 bg-indigo-950 rounded-lg text-indigo-400 mt-0.5 border border-indigo-800 flex-shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-[88%] leading-relaxed shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/20 text-xs'
                      : 'bg-gray-900/90 text-gray-200 border border-gray-800 rounded-tl-none text-xs'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    <MathRenderer content={msg.text} />
                  )}
                  {msg.provider && (
                    <span className="block text-[9px] text-gray-400 mt-1.5 font-mono">{msg.provider}</span>
                  )}
                </div>
                {msg.sender === 'user' && (
                  <div className="p-1.5 bg-gray-800 rounded-lg text-gray-300 mt-0.5 border border-gray-700 flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center space-x-2 text-indigo-400 text-xs py-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading document & formulating step-by-step answer...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Doubt Solver Input Bar */}
          <form onSubmit={handleSendQuestion} className="p-3 bg-gray-950 border-t border-gray-800/80 flex items-center space-x-2 flex-shrink-0">
            <input
              type="text"
              disabled={isProcessing}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={isProcessing ? "Waiting for text extraction..." : "Ask any doubt directly from this document..."}
              className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={sending || !inputQuestion.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
