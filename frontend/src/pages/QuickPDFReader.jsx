import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../api/client';
import { ArrowLeft, Sparkles, Send, Bot, User, Book, Loader2, AlertCircle, FileText, Download, Copy, Check } from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function QuickPDFReader() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get('document_id');

  const [documentInfo, setDocumentInfo] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [aiProvider, setAiProvider] = useState('groq');
  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Document AI Assistant. Ask me any doubt or conceptual question from this document.'
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

  const handleCopyText = () => {
    if (documentInfo?.content_text) {
      navigator.clipboard.writeText(documentInfo.content_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative">
      <header className="bg-gray-950/90 backdrop-blur-md border-b border-gray-800/80 px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center space-x-4">
          <Link to={`/classroom/${documentInfo.classroom_id || ''}`} className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Back to Classroom</span>
          </Link>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center space-x-2">
            {isDocx ? <FileText className="w-4 h-4 text-sky-400" /> : <Book className="w-4 h-4 text-indigo-400" />}
            <h1 className="text-sm font-bold text-white max-w-sm truncate">{documentInfo.filename}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
              isProcessing
                ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              {isProcessing ? 'Processing OCR...' : 'Ready (100%)'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>

          <a
            href={documentInfo.file_url}
            download={documentInfo.filename}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs px-3 py-1.5 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>

          <Link
            to={`/notebooklm?classroom_id=${documentInfo.classroom_id || ''}`}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>DLM Notebook Studio</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <div className="lg:col-span-7 border-r border-gray-800/80 bg-[#090d16] h-full overflow-hidden flex flex-col">
          {isPdf ? (
            <iframe
              src={documentInfo.file_url}
              className="w-full h-full border-0 bg-white"
              title={documentInfo.filename}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6">
              <div className="max-w-3xl mx-auto glass-card p-8 rounded-2xl border border-gray-800/80 shadow-2xl">
                <div className="border-b border-gray-800 pb-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-sky-400" />
                    <h2 className="text-base font-bold text-white">{documentInfo.filename}</h2>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">Word Document View</span>
                </div>

                {documentInfo.content_text ? (
                  <div className="prose prose-invert max-w-none text-xs leading-relaxed">
                    <MathRenderer content={documentInfo.content_text} />
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-xs">
                    {isProcessing ? 'Document is processing text extraction...' : 'No text content available in this document.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#090d16]/90 backdrop-blur-md flex flex-col h-full min-h-0 overflow-hidden">
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
                  className={`px-2 py-0.5 rounded font-semibold ${
                    aiProvider === 'groq' ? 'bg-orange-600 text-white shadow' : 'text-gray-400'
                  }`}
                >
                  Groq 120B ⚡
                </button>
                <button
                  onClick={() => setAiProvider('sarvam')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    aiProvider === 'sarvam' ? 'bg-indigo-600 text-white' : 'text-gray-400'
                  }`}
                >
                  Sarvam
                </button>
                <button
                  onClick={() => setAiProvider('gemini')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    aiProvider === 'gemini' ? 'bg-indigo-600 text-white' : 'text-gray-400'
                  }`}
                >
                  Gemini
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 font-sans text-xs">
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
                  className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg text-xs'
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
              <div className="flex items-center space-x-2 text-indigo-400 text-xs py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading document & formulating answer...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendQuestion} className="p-3 bg-gray-950 border-t border-gray-800/80 flex items-center space-x-2 flex-shrink-0">
            <input
              type="text"
              disabled={isProcessing}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={isProcessing ? "Waiting for text extraction..." : "Ask any doubt directly from this document..."}
              className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
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
