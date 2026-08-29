import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function QuickPDFReader() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [aiProvider, setAiProvider] = useState('gemini');

  // Quick Ephemeral Chat state
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Quick PDF AI Assistant. Ask me any doubt or question directly from this document.'
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
      // Track study session & streak
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

  // Auto-poll document status if OCR processing is in progress
  useEffect(() => {
    if (!documentInfo || documentInfo.processing_status === 'ready') return;
    const interval = setInterval(() => {
      fetchDoc();
    }, 2000);
    return () => clearInterval(interval);
  }, [documentInfo?.processing_status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        { sender: 'ai', text: 'Sorry, I encountered an error answering your doubt.' }
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loadingDoc) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-indigo-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!documentInfo) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <p>Document not found.</p>
        <Link to="/dashboard" className="mt-4 text-indigo-400 hover:underline text-xs">Return to Dashboard</Link>
      </div>
    );
  }

  const isProcessing = documentInfo.processing_status !== 'ready';

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative">
      {/* Top Header Bar (Flex Shrink 0) */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center space-x-4">
          <Link to={`/classroom/${documentInfo.classroom_id || ''}`} className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Classroom</span>
          </Link>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center space-x-2">
            <Book className="w-4 h-4 text-indigo-400" />
            <h1 className="text-sm font-bold text-white max-w-sm truncate">{documentInfo.filename}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
              isProcessing
                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {(() => {
                if (!isProcessing) return 'OCR Ready (100%)';
                const st = documentInfo.processing_status || '';
                if (st.startsWith('ocr_page_')) {
                  const parts = st.split('_');
                  return `Page ${parts[2]}/${parts[3]} OCR (${documentInfo.processing_progress || 75}%)`;
                }
                return `Processing (${documentInfo.processing_progress || 50}%)`;
              })()}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to={`/notebooklm?classroom_id=${documentInfo.classroom_id || ''}`}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700 text-xs px-3 py-1.5 rounded-xl transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open NotebookLM Permanent Studio</span>
          </Link>
        </div>
      </header>

      {/* Main Split Grid (Flex 1, Overflow Hidden) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column (6 Cols): Actual Visual PDF Viewer */}
        <div className="lg:col-span-6 border-r border-slate-800 bg-slate-950 h-full overflow-hidden flex flex-col">
          <iframe
            src={documentInfo.file_url}
            className="w-full h-full border-0 bg-white"
            title={documentInfo.filename}
          />
        </div>

        {/* Right Column (6 Cols): Ephemeral Quick Chatbot */}
        <div className="lg:col-span-6 bg-slate-900/90 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Active Chat Top Bar (Flex Shrink 0) */}
          <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">Quick Ephemeral Doubt Solving</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-400 font-mono">Engine:</span>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  onClick={() => setAiProvider('gemini')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    aiProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setAiProvider('sarvam')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    aiProvider === 'sarvam' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Sarvam
                </button>
              </div>
            </div>
          </div>

          {/* OCR Processing Notice Banner */}
          {isProcessing && (
            <div className="p-3 bg-amber-950/80 border-b border-amber-800/80 flex items-center space-x-2 text-xs text-amber-300 flex-shrink-0 animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                {(() => {
                  const st = documentInfo.processing_status || '';
                  if (st.startsWith('ocr_page_')) {
                    const parts = st.split('_');
                    return `📄 Extracting Page ${parts[2]} of ${parts[3]} (${documentInfo.processing_progress || 75}%). AI Chatbot will unlock when all pages finish.`;
                  }
                  return `📄 Extracting document text (${documentInfo.processing_progress || 50}%). AI Chatbot will unlock as soon as ready.`;
                })()}
              </span>
            </div>
          )}

          {/* Chat Messages Thread (Flex 1, Overflow Y Auto) */}
          <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-4 font-sans text-xs">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-3 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="p-2 bg-indigo-950 rounded-xl text-indigo-400 mt-0.5 border border-indigo-800">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl max-w-[85%] leading-relaxed ${ 
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg text-xs'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none text-xs'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    msg.text
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        table: ({node, ...props}) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full border border-slate-600 rounded-lg text-xs" {...props} />
                          </div>
                        ),
                        thead: ({node, ...props}) => <thead className="bg-indigo-900/60" {...props} />,
                        th: ({node, ...props}) => (
                          <th className="px-3 py-2 border border-slate-600 text-indigo-200 font-bold text-left" {...props} />
                        ),
                        td: ({node, ...props}) => (
                          <td className="px-3 py-2 border border-slate-700 text-slate-300" {...props} />
                        ),
                        tr: ({node, ...props}) => (
                          <tr className="even:bg-slate-700/30 hover:bg-slate-700/50 transition" {...props} />
                        ),
                        code: ({node, inline, className, children, ...props}) => {
                          if (inline) {
                            return <code className="bg-slate-700 text-indigo-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                          }
                          return (
                            <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 overflow-x-auto my-2">
                              <code className="text-green-300 text-xs font-mono" {...props}>{children}</code>
                            </pre>
                          );
                        },
                        strong: ({node, ...props}) => <strong className="text-indigo-200 font-bold" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-base font-bold text-white mt-3 mb-1.5 border-b border-slate-700 pb-1" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-sm font-bold text-indigo-300 mt-2.5 mb-1" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-xs font-bold text-indigo-400 mt-2 mb-1" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-1.5 pl-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-1.5 pl-2" {...props} />,
                        li: ({node, ...props}) => <li className="text-slate-300" {...props} />,
                        blockquote: ({node, ...props}) => (
                          <blockquote className="border-l-2 border-indigo-500 pl-3 my-2 text-slate-400 italic" {...props} />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                  {msg.provider && (
                    <span className="block text-[9px] text-slate-500 mt-2 font-mono">{msg.provider}</span>
                  )}
                </div>
                {msg.sender === 'user' && (
                  <div className="p-2 bg-slate-800 rounded-xl text-slate-300 mt-0.5 border border-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center space-x-2 text-indigo-400 text-xs py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reading document text & thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form (Flex Shrink 0 - Pinned to Bottom!) */}
          <form onSubmit={handleSendQuestion} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center space-x-3 flex-shrink-0">
            <input
              type="text"
              disabled={isProcessing}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={isProcessing ? "Waiting for GPU OCR extraction (100%)..." : "Ask any doubt directly from this PDF document..."}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={sending || !inputQuestion.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition shadow-lg shadow-indigo-600/20 flex items-center justify-center flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
