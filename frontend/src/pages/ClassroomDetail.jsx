import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { 
  BookOpen, Sparkles, MessageSquare, Send, Upload, FileText, HelpCircle, 
  ArrowLeft, Eye, X, Book, Users, LogOut, Mail, UserCheck, AlertCircle, 
  PlusCircle, Zap, Plus, Trash2, Clock, Edit3, Save, Sliders, BarChart3, 
  CheckCircle2, CheckSquare, Square, Search, Award, Loader2,
  FolderPlus, Folder, FolderOpen, ChevronDown, ChevronRight, FileCode
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MathRenderer from '../components/MathRenderer';
import { formatISTDateTime, formatISTDate } from '../utils/formatDate';

export default function ClassroomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [classroom, setClassroom] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [documents, setDocuments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState('docs');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [quizError, setQuizError] = useState('');

  // Note Folder / Grouping States
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [activeTargetFolder, setActiveTargetFolder] = useState('General Notes');
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // Edit Classroom Modal State
  const [isEditClassroomModalOpen, setIsEditClassroomModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updatingClassroom, setUpdatingClassroom] = useState(false);

  // AI Quiz Generation Modal State (Difficulty 1-10 + Custom Document Selector + Competency %)
  const [isAiQuizModalOpen, setIsAiQuizModalOpen] = useState(false);
  const [aiQuizTitle, setAiQuizTitle] = useState('');
  const [aiQuizNumQuestions, setAiQuizNumQuestions] = useState(5);
  const [aiQuizDifficulty, setAiQuizDifficulty] = useState(5);
  const [aiQuizCompetency, setAiQuizCompetency] = useState(50);
  const [aiQuizSelectedDocIds, setAiQuizSelectedDocIds] = useState([]);
  const [inProgressQuiz, setInProgressQuiz] = useState(null);

  // Teacher Quiz Submissions Analytics Modal State
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [selectedQuizForSubmissions, setSelectedQuizForSubmissions] = useState(null);
  const [quizSubmissionsData, setQuizSubmissionsData] = useState(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionsSearchQuery, setSubmissionsSearchQuery] = useState('');

  // Manual Quiz Modal State
  const [isManualQuizModalOpen, setIsManualQuizModalOpen] = useState(false);
  const [manualQuizTitle, setManualQuizTitle] = useState('');
  const [manualQuizDesc, setManualQuizDesc] = useState('');
  const [manualQuestions, setManualQuestions] = useState([
    {
      id: 1,
      question: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: ''
    }
  ]);
  const [submittingManualQuiz, setSubmittingManualQuiz] = useState(false);

  // Document Reader Modal State
  const [readingDoc, setReadingDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' or 'text'

  const [loadingClass, setLoadingClass] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    try {
      setLoadingClass(true);
      const [classRes, postsRes, docsRes, quizRes, studentRes] = await Promise.allSettled([
        API.get(`/api/classroom/${id}`),
        API.get(`/api/classroom/${id}/posts`),
        API.get(`/api/upload/list?classroom_id=${id}`),
        API.get(`/api/quiz/list/${id}`),
        API.get(`/api/classroom/${id}/students`)
      ]);

      if (classRes.status === 'fulfilled' && classRes.value.data) {
        setClassroom(classRes.value.data);
        setEditName(classRes.value.data.name);
        setEditDescription(classRes.value.data.description || '');
        setLoadError('');
      } else {
        setLoadError('Classroom not found or you may not be enrolled.');
      }

      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data || []);
      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value.data || []);
      if (quizRes.status === 'fulfilled') setQuizzes(quizRes.value.data || []);
      if (studentRes.status === 'fulfilled') setStudents(studentRes.value.data || []);
    } catch (err) {
      console.error("Error loading classroom details", err);
      setLoadError('Failed to load classroom details.');
    } finally {
      setLoadingClass(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const hasUnfinishedDocs = documents.some(d => d.processing_status && d.processing_status !== 'ready');
    if (!hasUnfinishedDocs && !uploading) return;

    const interval = setInterval(() => {
      API.get(`/api/upload/list?classroom_id=${id}`).then((res) => {
        setDocuments(res.data);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [id, documents, uploading]);

  // Auto-refresh readingDoc modal while OCR is still in progress
  useEffect(() => {
    if (!readingDoc || readingDoc.processing_status === 'ready') return;

    const interval = setInterval(() => {
      API.get(`/api/upload/document/${readingDoc.id}`).then((res) => {
        setReadingDoc(res.data);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [readingDoc]);

  const handleOpenEditClassroomModal = () => {
    setEditName(classroom.name);
    setEditDescription(classroom.description || '');
    setIsEditClassroomModalOpen(true);
  };

  const handleUpdateClassroom = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setUpdatingClassroom(true);
    try {
      const res = await API.put(`/api/classroom/${id}`, {
        name: editName.trim(),
        description: editDescription.trim()
      });
      setClassroom(res.data);
      setIsEditClassroomModalOpen(false);
    } catch (err) {
      console.error("Failed to update classroom details", err);
    } finally {
      setUpdatingClassroom(false);
    }
  };

  const handleOpenDocumentReader = async (docId) => {
    setLoadingDoc(true);
    try {
      const res = await API.get(`/api/upload/document/${docId}`);
      setReadingDoc(res.data);
      setViewMode('pdf');
      // Track study session & streak
      API.post('/api/analytics/track-view', null, { params: { document_id: docId, time_spent_seconds: 45 } }).catch(() => {});
    } catch (err) {
      console.error("Error fetching document text", err);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this study note? It will also be removed from vector database.")) return;
    try {
      await API.delete(`/api/upload/document/${docId}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete document note", err);
    }
  };

  const handleLeaveClassroom = async () => {
    if (!window.confirm("Are you sure you want to leave this classroom?")) return;
    setLeaving(true);
    try {
      await API.delete(`/api/classroom/${id}/leave`);
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to leave classroom", err);
      setLeaving(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    try {
      await API.post(`/api/classroom/${id}/posts`, { content: newPost });
      setNewPost('');
      const res = await API.get(`/api/classroom/${id}/posts`);
      setPosts(res.data);
    } catch (err) {
      console.error("Error creating post", err);
    }
  };

  // Support Multiple File Upload (PDF, DOCX, PPTX, TXT, MD) with Folder Grouping
  const handleFileUpload = async (e, customFolder = null) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const targetFolder = customFolder || activeTargetFolder || 'General Notes';

    setUploading(true);
    setUploadProgress(10);
    setQuizError('');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('classroom_id', id);
      formData.append('folder_name', targetFolder);

      await API.post('/api/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(pct);
          }
        }
      });
      setUploadProgress(100);
      loadData();
    } catch (err) {
      console.error("File upload failed", err);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 800);
    }
  };

  const toggleFolderCollapse = (folderName) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleCreateNewFolder = (e) => {
    e?.preventDefault();
    const trimmed = newFolderNameInput.trim();
    if (!trimmed) return;
    setActiveTargetFolder(trimmed);
    setNewFolderNameInput('');
    setNewFolderModalOpen(false);
  };

  // AI Quiz Generation Handlers (Difficulty 1-10 + Document Selection + Competency %)
  const handleOpenAiQuizModal = () => {
    setAiQuizTitle(`AI Practice Quiz - ${formatISTDate(new Date())}`);
    setAiQuizNumQuestions(5);
    setAiQuizDifficulty(5);
    setAiQuizCompetency(50);
    setAiQuizSelectedDocIds(documents.map(d => d.id));
    setQuizError('');
    setIsAiQuizModalOpen(true);
  };

  const handleToggleDocSelection = (docId) => {
    setAiQuizSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter(i => i !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    if (aiQuizSelectedDocIds.length === documents.length) {
      setAiQuizSelectedDocIds([]);
    } else {
      setAiQuizSelectedDocIds(documents.map(d => d.id));
    }
  };

  const handleGenerateAiQuiz = async (e) => {
    e?.preventDefault();
    if (!aiQuizTitle.trim()) {
      alert("Please enter a Quiz Title");
      return;
    }
    if (aiQuizSelectedDocIds.length === 0) {
      alert("Please select at least one study note or PDF document");
      return;
    }

    const title = aiQuizTitle.trim();
    const numQ = parseInt(aiQuizNumQuestions);
    const diff = parseInt(aiQuizDifficulty);
    const comp = parseInt(aiQuizCompetency);
    const docIds = [...aiQuizSelectedDocIds];

    // Close configuration modal immediately so UI remains completely interactive and non-blocking
    setIsAiQuizModalOpen(false);
    setGeneratingQuiz(true);
    setQuizError('');

    // In-place live card initialized
    setInProgressQuiz({
      title: title,
      num_questions: numQ,
      difficulty: diff,
      competency: comp,
      progress: 12,
      statusText: `Extracting text from ${docIds.length} source note(s)...`
    });

    const progressInterval = setInterval(() => {
      setInProgressQuiz((prev) => {
        if (!prev) return null;
        let nextProg = prev.progress;
        let nextStatus = prev.statusText;

        if (nextProg < 30) {
          nextProg += 6;
          nextStatus = `Extracted notes text. Analyzing previous classroom quizzes for deduplication...`;
        } else if (nextProg < 65) {
          nextProg += 7;
          nextStatus = `Groq AI batch-generating ${numQ} MCQs (Difficulty ${diff}/10, ${comp}% Competency)...`;
        } else if (nextProg < 92) {
          nextProg += 4;
          nextStatus = `Synthesizing KaTeX LaTeX formula derivations & options...`;
        }

        return {
          ...prev,
          progress: Math.min(nextProg, 94),
          statusText: nextStatus
        };
      });
    }, 900);

    try {
      await API.post('/api/quiz/generate', {
        classroom_id: parseInt(id),
        num_questions: numQ,
        difficulty: diff,
        competency_percentage: comp,
        document_ids: docIds,
        title: title
      });

      clearInterval(progressInterval);
      setInProgressQuiz((prev) => prev ? ({ ...prev, progress: 100, statusText: 'Quiz created & published successfully!' }) : null);

      setTimeout(() => {
        setInProgressQuiz(null);
        setGeneratingQuiz(false);
        loadData();
      }, 700);

    } catch (err) {
      clearInterval(progressInterval);
      setInProgressQuiz(null);
      setGeneratingQuiz(false);
      const msg = err.response?.data?.detail || "Quiz generation failed.";
      setQuizError(msg);
    }
  };

  // Teacher View Submissions Analytics Handler
  const handleViewSubmissions = async (quiz) => {
    setSelectedQuizForSubmissions(quiz);
    setIsSubmissionsModalOpen(true);
    setLoadingSubmissions(true);
    setSubmissionsSearchQuery('');
    try {
      const res = await API.get(`/api/quiz/${quiz.id}/analytics`);
      setQuizSubmissionsData(res.data);
    } catch (err) {
      console.error("Failed to load quiz submissions analytics", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleDeleteQuiz = async (quizId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await API.delete(`/api/quiz/${quizId}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete quiz", err);
    }
  };

  // Manual Quiz Handlers
  const handleAddQuestion = () => {
    setManualQuestions((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        question: '',
        options: ['', '', '', ''],
        correct_index: 0,
        explanation: ''
      }
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (manualQuestions.length <= 1) return;
    setManualQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx, field, value) => {
    setManualQuestions((prev) => prev.map((q, i) => {
      if (i === idx) return { ...q, [field]: value };
      return q;
    }));
  };

  const handleOptionChange = (qIdx, optIdx, value) => {
    setManualQuestions((prev) => prev.map((q, i) => {
      if (i === qIdx) {
        const newOpts = [...q.options];
        newOpts[optIdx] = value;
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const handleSubmitManualQuiz = async (e) => {
    e.preventDefault();
    if (!manualQuizTitle.trim()) {
      alert("Please enter a Quiz Title");
      return;
    }
    setSubmittingManualQuiz(true);
    try {
      await API.post('/api/quiz/manual', {
        classroom_id: parseInt(id),
        title: manualQuizTitle,
        description: manualQuizDesc || `Teacher created quiz (${manualQuestions.length} Questions)`,
        questions: manualQuestions
      });
      setIsManualQuizModalOpen(false);
      setManualQuizTitle('');
      setManualQuizDesc('');
      setManualQuestions([
        { id: 1, question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }
      ]);
      loadData();
    } catch (err) {
      console.error("Error creating manual quiz", err);
    } finally {
      setSubmittingManualQuiz(false);
    }
  };

  if (loadingClass && !classroom) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-[#090d16] text-gray-400 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs font-mono">Loading Classroom details...</span>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-[#090d16] text-gray-300 p-6">
        <div className="max-w-md glass-card p-8 rounded-3xl border border-gray-800 text-center space-y-4 shadow-2xl">
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-2xl w-fit mx-auto text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Classroom Unavailable</h2>
          <p className="text-xs text-gray-400">
            {loadError || 'This classroom does not exist or you do not have permission to view it.'}
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Classrooms</span>
          </Link>
        </div>
      </div>
    );
  }

  const isTeacher = user?.role === 'teacher' && classroom?.teacher_id === user?.id;

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 relative z-10">
        {/* Top Navigation & Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-gray-800/80">
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-1.5 text-gray-400 hover:text-white text-xs font-semibold transition py-1"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {user?.role === 'student' && (
              <button
                onClick={handleLeaveClassroom}
                disabled={leaving}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-semibold px-3 py-2 rounded-xl transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{leaving ? 'Leaving...' : 'Leave Classroom'}</span>
              </button>
            )}

            <Link
              to={`/notebooklm?classroom_id=${id}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20 text-center"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open OmniAI Studio</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Main Feed & Classroom Info (Left 2 Cols) */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6">
            {/* CLASSROOM BANNER CARD (Shifted to Left Column) */}
            <div className="glass-card px-4 sm:px-5 py-3.5 rounded-2xl border border-gray-800/80 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="w-full sm:w-auto">
                  <div className="flex items-center space-x-2.5">
                    <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{classroom.name}</h1>
                    {isTeacher && (
                      <button
                        onClick={handleOpenEditClassroomModal}
                        title="Edit Classroom Details"
                        className="p-1 text-gray-400 hover:text-indigo-300 bg-gray-900/80 hover:bg-indigo-950 border border-gray-700 hover:border-indigo-600 rounded-lg transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{classroom.description || 'Classroom feed and study workspace'}</p>
                  <p className="text-[11px] text-gray-400 mt-1 font-medium">
                    Instructor: <span className="text-indigo-300 font-semibold">{classroom.teacher_name}</span>
                  </p>
                </div>

                {isTeacher && (
                  <div className="w-full sm:w-auto bg-gray-900/90 px-3.5 py-1.5 rounded-xl border border-gray-800 text-center shadow-inner flex justify-between sm:flex-col items-center gap-1 sm:gap-0 flex-shrink-0">
                    <span className="text-[9px] text-gray-400 uppercase font-mono tracking-wider">Class Join Code</span>
                    <span className="text-base font-mono font-bold text-indigo-400 tracking-widest">{classroom.code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Create Post */}
            <div className="glass-card rounded-2xl border border-gray-800/80 p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Announce something to your class</span>
              </h3>
              <form onSubmit={handleCreatePost} className="space-y-3">
                <textarea
                  rows="3"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share an announcement, assignment update, or study tip..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Posts Stream */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Class Feed Stream</h3>
              {posts.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
                  No announcements posted yet.
                </div>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="glass-card rounded-2xl border border-gray-800/80 p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-300">{p.author_name}</span>
                      <span className="text-[11px] text-slate-500">{formatISTDateTime(p.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{p.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Unified Tabbed Sidebar (Right Col) */}
          <div>
            <div className="glass-card rounded-2xl border border-gray-800/80 p-5 shadow-lg">
              {/* Segmented Tab Navigation Switcher */}
              <div className="flex items-center bg-gray-900/90 p-1 rounded-2xl border border-gray-800/80 mb-5 gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('docs')}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                    activeSidebarTab === 'docs'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes ({documents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSidebarTab('quizzes')}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                  activeSidebarTab === 'quizzes'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Quizzes ({quizzes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSidebarTab('students')}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                  activeSidebarTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Students ({students.length})</span>
              </button>
            </div>

            {/* TAB 1: STUDY NOTES & DOCUMENTS (Grouped by Unit / Folder) */}
            {activeSidebarTab === 'docs' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-800/80 gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Classroom Study Notes
                    </h3>
                    <p className="text-[10px] text-gray-400">PDFs, Word Docs, PPTs & Text Notes</p>
                  </div>
                  {user?.role === 'teacher' && (
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setNewFolderModalOpen(!newFolderModalOpen)}
                        className="bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-800/60 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
                        title="Create a new unit/chapter folder to group your notes"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>New Group</span>
                      </button>

                      <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading ? 'Uploading...' : 'Upload Notes'}</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                          multiple
                          onChange={(e) => handleFileUpload(e, activeTargetFolder)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Inline New Group Creation Box */}
                {newFolderModalOpen && (
                  <form onSubmit={handleCreateNewFolder} className="bg-indigo-950/40 border border-indigo-700/60 p-3 rounded-xl space-y-2 animate-in fade-in zoom-in duration-150">
                    <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                      <FolderPlus className="w-3.5 h-3.5" />
                      Create New Unit / Group Name
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderNameInput}
                        onChange={(e) => setNewFolderNameInput(e.target.value)}
                        placeholder="e.g., Unit 1: Thermodynamics, Chapter 3: Motion..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!newFolderNameInput.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewFolderModalOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}

                {/* Upload Progress Bar (0% to 100%) */}
                {uploading && (
                  <div className="bg-slate-900 p-3 rounded-xl border border-indigo-800/60">
                    <div className="flex justify-between text-xs text-indigo-300 font-mono mb-1">
                      <span>Extracting & Indexing Notes...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {documents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No study documents uploaded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {(() => {
                      const grouped = documents.reduce((acc, doc) => {
                        const f = (doc.folder_name && doc.folder_name.trim()) || 'General Notes';
                        if (!acc[f]) acc[f] = [];
                        acc[f].push(doc);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([folderName, folderDocs]) => {
                        const isCollapsed = Boolean(collapsedFolders[folderName]);

                        return (
                          <div key={folderName} className="bg-slate-900/90 border border-slate-800/90 rounded-xl overflow-hidden shadow-sm">
                            {/* Folder Accordion Header */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-950/80 border-b border-slate-800/60 select-none">
                              <button
                                type="button"
                                onClick={() => toggleFolderCollapse(folderName)}
                                className="flex items-center space-x-2 text-left min-w-0 flex-1 group"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-white transition" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-white transition" />
                                )}
                                {isCollapsed ? (
                                  <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                ) : (
                                  <FolderOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                )}
                                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-200 truncate">
                                  {folderName}
                                </span>
                                <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.2 rounded-full">
                                  {folderDocs.length}
                                </span>
                              </button>

                              {user?.role === 'teacher' && (
                                <label
                                  title={`Upload notes into '${folderName}'`}
                                  className="cursor-pointer p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                                    multiple
                                    onChange={(e) => handleFileUpload(e, folderName)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {/* Folder Notes Content */}
                            {!isCollapsed && (
                              <div className="p-2 space-y-2 bg-slate-900/50">
                                {folderDocs.map((doc) => {
                                  const status = doc.processing_status || 'ready';
                                  const isProcessing = status === 'processing';
                                  const isPageOcr = status.startsWith('page_');
                                  const isReady = status === 'ready';
                                  const progress = doc.processing_progress || 100;
                                  const isDocOwner = user?.role === 'teacher' && doc.uploaded_by_id === user?.id;

                                  let statusText = `Ready (100%)`;
                                  if (isProcessing) statusText = `Extracting (${progress}%)`;
                                  if (isPageOcr) {
                                    const parts = status.split('_');
                                    statusText = `Page ${parts[1]}/${parts[2]} (${progress}%)`;
                                  }

                                  const ext = doc.filename.split('.').pop()?.toUpperCase() || 'DOC';

                                  return (
                                    <div key={doc.id} className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 hover:border-indigo-500/40 transition">
                                      <div className="flex items-center justify-between mb-1.5 gap-2">
                                        <div className="flex items-center space-x-1.5 min-w-0">
                                          <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                                            {ext}
                                          </span>
                                          <span className="text-xs text-slate-200 font-medium truncate max-w-[150px] sm:max-w-[190px]" title={doc.filename}>
                                            {doc.filename}
                                          </span>
                                        </div>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                          isReady
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                            : 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                                        }`}>
                                          {statusText}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-end space-x-1.5 mt-2">
                                        <button
                                          onClick={() => handleOpenDocumentReader(doc.id)}
                                          className="flex items-center space-x-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-1 rounded-lg border border-indigo-800 transition"
                                        >
                                          <Eye className="w-3 h-3 text-indigo-400" />
                                          <span>Open</span>
                                        </button>

                                        {isReady ? (
                                          <Link
                                            to={`/quick-reader?document_id=${doc.id}`}
                                            className="text-[11px] bg-indigo-950 text-indigo-300 px-2 py-1 rounded-lg border border-indigo-700 hover:bg-indigo-900 transition font-medium"
                                          >
                                            Quick Q&A
                                          </Link>
                                        ) : (
                                          <button
                                            disabled
                                            className="text-[11px] bg-slate-900 text-slate-600 px-2 py-1 rounded-lg border border-slate-800 cursor-not-allowed font-mono opacity-60"
                                          >
                                            Indexing...
                                          </button>
                                        )}

                                        {isDocOwner && (
                                          <button
                                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                                            title="Delete Study Note (Remove from Vector DB & Disk)"
                                            className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRACTICE QUIZZES */}
            {activeSidebarTab === 'quizzes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Practice Quizzes
                    </h3>
                    <p className="text-[10px] text-gray-400">Classroom Assessments & MCQs</p>
                  </div>

                  {user?.role === 'teacher' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleOpenAiQuizModal}
                        disabled={generatingQuiz}
                        title="⚡ AI Assessment Quiz Generator"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1 shadow-md shadow-indigo-600/20"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                        <span>{generatingQuiz ? 'Generating...' : 'AI Quiz'}</span>
                      </button>

                      <button
                        onClick={() => setIsManualQuizModalOpen(true)}
                        title="➕ Create Manual Quiz"
                        className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Manual</span>
                      </button>
                    </div>
                  )}
                </div>

                {quizError && (
                  <div className="p-3 bg-amber-950/70 border border-amber-800/80 rounded-xl flex items-start space-x-2 text-xs text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{quizError}</span>
                  </div>
                )}

                {!inProgressQuiz && quizzes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No practice quizzes available yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {/* In-Progress Sparkle Card */}
                    {inProgressQuiz && (
                      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-xl animate-pulse-glow transition">
                        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse flex-shrink-0" />
                            <h4 className="text-xs font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent truncate">
                              {inProgressQuiz.title}
                            </h4>
                          </div>
                          <span className="bg-indigo-950 text-cyan-300 border border-indigo-700/80 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0 animate-pulse">
                            {inProgressQuiz.progress}%
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 font-sans line-clamp-1 mb-2.5">
                          {inProgressQuiz.statusText}
                        </p>

                        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden mb-2.5">
                          <div
                            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${inProgressQuiz.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {quizzes.map((quiz) => (
                      <div key={quiz.id} className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">{quiz.title}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{quiz.description}</p>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1.5">
                              <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono">
                                {quiz.questions_json?.length || 5} MCQs
                              </span>
                              <span className="flex items-center space-x-1 text-slate-500">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{formatISTDateTime(quiz.created_at)}</span>
                              </span>
                            </div>
                          </div>

                          {user?.role === 'teacher' && (
                            <button
                              onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                              title="Delete Quiz"
                              className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 pt-1">
                          {user?.role === 'teacher' && (
                            <button
                              onClick={() => handleViewSubmissions(quiz)}
                              title="View student submissions & first attempt scores"
                              className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-800/80 text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center space-x-1.5"
                            >
                              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Submissions</span>
                            </button>
                          )}
                          <Link
                            to={`/quiz/${quiz.id}`}
                            className={`${user?.role === 'teacher' ? 'flex-1' : 'w-full'} text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 rounded-lg transition shadow flex items-center justify-center space-x-1`}
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Attempt Quiz</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ENROLLED STUDENTS */}
            {activeSidebarTab === 'students' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Enrolled Students
                    </h3>
                    <p className="text-[10px] text-gray-400">{students.length} Student(s) currently enrolled</p>
                  </div>
                </div>

                {students.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No students enrolled in this class yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {students.map((st) => (
                      <div key={st.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center space-x-3 hover:border-indigo-500/30 transition">
                        <div className="p-2 bg-indigo-950 rounded-xl text-indigo-400 border border-indigo-800/60">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="truncate flex-1">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{st.full_name}</h4>
                          {user?.role === 'teacher' && (
                            <p className="text-[11px] text-indigo-300 font-mono flex items-center space-x-1 truncate mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500 inline" />
                              <span>{st.email}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT CLASSROOM MODAL FOR TEACHERS */}
      {isEditClassroomModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Edit Classroom Details</h3>
              </div>
              <button
                onClick={() => setIsEditClassroomModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateClassroom} className="p-5 space-y-4 bg-slate-950 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Classroom Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., Advanced Quantum Physics 2026"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Classroom Description</label>
                <textarea
                  rows="3"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter classroom subject details, office hours, or syllabus info..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditClassroomModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingClassroom || !editName.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shadow-lg shadow-indigo-600/20 flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{updatingClassroom ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL QUIZ CREATION MODAL FOR TEACHERS */}
      {isManualQuizModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Create Manual Quiz</h3>
              </div>
              <button
                onClick={() => setIsManualQuizModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitManualQuiz} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Quiz Title *</label>
                <input
                  type="text"
                  required
                  value={manualQuizTitle}
                  onChange={(e) => setManualQuizTitle(e.target.value)}
                  placeholder="e.g., Chapter 1 Physics Practice Quiz"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Quiz Description (Optional)</label>
                <input
                  type="text"
                  value={manualQuizDesc}
                  onChange={(e) => setManualQuizDesc(e.target.value)}
                  placeholder="e.g., Covers Newton's laws and acceleration formulas"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Questions Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider">Questions ({manualQuestions.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="flex items-center space-x-1 bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 px-2.5 py-1 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {manualQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400 font-mono">Q{qIdx + 1}. Question Statement</span>
                      {manualQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                      placeholder="Enter question statement..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />

                    {/* 4 Options Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-1.5">
                          <span className="text-slate-400 font-mono font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Correct Index Selector & Explanation */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-mono mb-1">Correct Answer *</label>
                        <select
                          value={q.correct_index}
                          onChange={(e) => handleQuestionChange(qIdx, 'correct_index', parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-semibold"
                        >
                          <option value={0}>Option A (Index 0)</option>
                          <option value={1}>Option B (Index 1)</option>
                          <option value={2}>Option C (Index 2)</option>
                          <option value={3}>Option D (Index 3)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-mono mb-1">Explanation (Optional)</label>
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                          placeholder="Why is this answer correct?"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Submit Footer */}
              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsManualQuizModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManualQuiz}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shadow-lg shadow-indigo-600/20"
                >
                  {submittingManualQuiz ? 'Publishing...' : 'Publish Manual Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL SCREEN PDF DOCUMENT READER MODAL */}
      {readingDoc && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-6xl w-full h-[95vh] sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Reader Header */}
            <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                <Book className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">{readingDoc.filename}</h3>
                  <span className="text-[10px] text-indigo-400 uppercase font-mono">Actual PDF Document Viewer</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-1">
                <div className="flex bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setViewMode('pdf')}
                    className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition ${
                      viewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    PDF View
                  </button>
                  <button
                    onClick={() => setViewMode('text')}
                    className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition ${
                      viewMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Text View
                  </button>
                </div>

                {readingDoc.processing_status === 'ready' ? (
                  <Link
                    to={`/quick-reader?document_id=${readingDoc.id}`}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] sm:text-xs font-semibold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask DLM AI</span>
                  </Link>
                ) : (
                  <button
                    disabled
                    title="Please wait until GPU OCR completes (100%)"
                    className="flex items-center space-x-1 bg-slate-800 text-slate-500 text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-xl cursor-not-allowed opacity-60 font-mono"
                  >
                    <Sparkles className="w-3 h-3 text-slate-600" />
                    <span>Processing...</span>
                  </button>
                )}

                <button
                  onClick={() => setReadingDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition ml-auto sm:ml-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content Reader Body */}
            <div className="flex-1 overflow-hidden bg-slate-950">
              {viewMode === 'pdf' ? (
                <iframe
                  src={readingDoc.file_url}
                  className="w-full h-full border-0 bg-white"
                  title={readingDoc.filename}
                />
              ) : (
                <div className="p-6 h-full overflow-y-auto font-sans leading-relaxed text-slate-200">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {readingDoc.processing_status !== 'ready' ? (
                      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-4 animate-pulse">
                        <div className="h-4 bg-slate-800 rounded w-full"></div>
                        <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                        <div className="h-4 bg-slate-800 rounded w-4/6"></div>
                        <p className="text-xs text-amber-400 font-sans mt-4">
                          {(() => {
                            const st = readingDoc.processing_status || '';
                            if (st.startsWith('ocr_page_')) {
                              const parts = st.split('_');
                              return `📄 Extracting Page ${parts[2]} of ${parts[3]} (${readingDoc.processing_progress || 50}% complete)...`;
                            }
                            return `📄 Extracting text page-by-page (${readingDoc.processing_progress || 50}% complete)...`;
                          })()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-inner max-w-none text-sm">
                        <MathRenderer content={readingDoc.content_text} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI ASSESSMENT QUIZ GENERATION MODAL FOR TEACHERS */}
      {isAiQuizModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">AI Assessment Quiz Generator</h3>
                  <span className="text-[10px] text-indigo-400 font-mono">Calibrate Difficulty & Select Source Notes</span>
                </div>
              </div>
              <button
                onClick={() => setIsAiQuizModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateAiQuiz} className="p-5 space-y-4 bg-slate-950 text-xs overflow-y-auto">
              {/* Quiz Title */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Quiz Title *</label>
                <input
                  type="text"
                  required
                  value={aiQuizTitle}
                  onChange={(e) => setAiQuizTitle(e.target.value)}
                  placeholder="e.g., Module 5: Lasers & Superconductivity Quiz"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Number of Questions</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 10, 15].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAiQuizNumQuestions(num)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        aiQuizNumQuestions === num
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {num} MCQs
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level Slider (1 to 10) */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span>Difficulty Level (1 - 10)</span>
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    aiQuizDifficulty <= 3
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                      : aiQuizDifficulty <= 7
                      ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                      : 'bg-red-950/80 border-red-600 text-red-300'
                  }`}>
                    {aiQuizDifficulty <= 3
                      ? `Level ${aiQuizDifficulty}: Foundational / Easy`
                      : aiQuizDifficulty <= 7
                      ? `Level ${aiQuizDifficulty}: Intermediate / Applied`
                      : `Level ${aiQuizDifficulty}: Expert / Advanced`}
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="10"
                  value={aiQuizDifficulty}
                  onChange={(e) => setAiQuizDifficulty(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 (Basic Definitions)</span>
                  <span>5 (Applied Concepts)</span>
                  <span>10 (Tricky & Expert)</span>
                </div>
              </div>

              {/* Competency-Based Percentage Slider (0% to 100%) */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-indigo-400" />
                    <span>Competency Ratio ({aiQuizCompetency}%)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-indigo-950/80 border-indigo-600 text-indigo-300 font-mono">
                    {Math.round((aiQuizCompetency / 100) * aiQuizNumQuestions)} of {aiQuizNumQuestions} Scenario MCQs
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={aiQuizCompetency}
                  onChange={(e) => setAiQuizCompetency(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% (All Direct Recall)</span>
                  <span>50% (Balanced)</span>
                  <span>100% (All Case Studies)</span>
                </div>
              </div>

              {/* Source Document Selector */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Select Source Study Notes ({aiQuizSelectedDocIds.length}/{documents.length})</span>
                  </label>
                  {documents.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllDocs}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      {aiQuizSelectedDocIds.length === documents.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {documents.length === 0 ? (
                  <p className="text-[11px] text-amber-400">
                    ⚠️ No study notes uploaded in this classroom yet. Please upload a PDF note first.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {documents.map((doc) => {
                      const isSelected = aiQuizSelectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleToggleDocSelection(doc.id)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-950/60 border-indigo-600/80 text-white'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                            )}
                            <span className="truncate text-xs font-medium">{doc.filename}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono flex-shrink-0 ml-2">
                            {doc.processing_status === 'ready' ? '✅ Ready' : '⏳ OCR'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit & Cancel */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAiQuizModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingQuiz || documents.length === 0 || aiQuizSelectedDocIds.length === 0 || !aiQuizTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition shadow-lg shadow-indigo-600/20 flex items-center space-x-2"
                >
                  {generatingQuiz ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Groq AI Generating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Generate Quiz (Groq AI)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEACHER QUIZ SUBMISSIONS & SCORES ANALYTICS MODAL */}
      {isSubmissionsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Student Submissions & Score Tracking</h3>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    {selectedQuizForSubmissions?.title || 'Quiz Analytics'} • First Attempt Grades
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingSubmissions ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs font-mono">Loading classroom roster & scores...</span>
              </div>
            ) : quizSubmissionsData ? (
              <div className="p-5 space-y-4 bg-slate-950 text-xs overflow-y-auto">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-mono block">Enrolled Students</span>
                    <span className="text-base sm:text-lg font-bold text-white mt-1 block">{quizSubmissionsData.total_students}</span>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl">
                    <span className="text-[10px] text-emerald-400 font-mono block">Attempted</span>
                    <span className="text-base sm:text-lg font-bold text-emerald-300 mt-1 block">{quizSubmissionsData.attempted_count}</span>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl">
                    <span className="text-[10px] text-amber-400 font-mono block">Pending</span>
                    <span className="text-base sm:text-lg font-bold text-amber-300 mt-1 block">{quizSubmissionsData.pending_count}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/60 p-3 rounded-xl">
                    <span className="text-[10px] text-indigo-400 font-mono block">Class Average</span>
                    <span className="text-base sm:text-lg font-bold text-indigo-300 mt-1 block truncate">
                      {quizSubmissionsData.average_score != null
                        ? `${quizSubmissionsData.average_score} / ${quizSubmissionsData.max_score}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={submissionsSearchQuery}
                    onChange={(e) => setSubmissionsSearchQuery(e.target.value)}
                    placeholder="Search student by name or email..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Submissions Roster Table (Horizontally scrollable on narrow mobile screens) */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 overflow-x-auto">
                  <div className="min-w-[500px]">
                    <div className="grid grid-cols-12 bg-slate-900 p-3 text-[11px] font-bold text-slate-400 border-b border-slate-800">
                      <span className="col-span-4">Student</span>
                      <span className="col-span-3 text-center">Status</span>
                      <span className="col-span-2 text-center">1st Score</span>
                      <span className="col-span-3 text-right">Submitted At</span>
                    </div>

                  <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                    {quizSubmissionsData.submissions
                      .filter((s) => {
                        const q = submissionsSearchQuery.toLowerCase();
                        return s.student_name.toLowerCase().includes(q) || s.student_email.toLowerCase().includes(q);
                      })
                      .map((sub) => (
                        <div key={sub.student_id} className="grid grid-cols-12 p-3 items-center text-xs hover:bg-slate-800/40 transition">
                          {/* Student Name & Email */}
                          <div className="col-span-4 flex items-center space-x-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {sub.student_name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-200 truncate">{sub.student_name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{sub.student_email}</p>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="col-span-3 text-center">
                            {sub.has_attempted ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-600/80 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Attempted</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 border border-amber-700/60 text-amber-300">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>

                          {/* First Attempt Score */}
                          <div className="col-span-2 text-center">
                            {sub.has_attempted ? (
                              <span className="font-bold text-indigo-300 font-mono text-xs">
                                {sub.first_attempt_score} / {sub.max_score}
                                <span className="text-[10px] text-slate-400 block font-normal">({sub.percentage}%)</span>
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-xs">-</span>
                            )}
                          </div>

                          {/* Submission Date */}
                          <div className="col-span-3 text-right text-[10px] text-slate-400 font-mono">
                            {sub.completed_at
                              ? formatISTDateTime(sub.completed_at)
                              : 'Not yet'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-8 text-center text-slate-500 text-xs">No submission data available.</p>
            )}

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
