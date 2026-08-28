import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, Sparkles, MessageSquare, Send, Upload, FileText, HelpCircle, ArrowLeft, Eye, X, Book, Users, LogOut, Mail, UserCheck, AlertCircle, PlusCircle, Zap, Plus, Trash2, Clock, Edit3, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TiltCard3D from '../components/TiltCard3D';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [quizError, setQuizError] = useState('');

  // Edit Classroom Modal State
  const [isEditClassroomModalOpen, setIsEditClassroomModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updatingClassroom, setUpdatingClassroom] = useState(false);

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

  const loadData = async () => {
    try {
      const [classRes, postsRes, docsRes, quizRes, studentRes] = await Promise.all([
        API.get(`/api/classroom/${id}`),
        API.get(`/api/classroom/${id}/posts`),
        API.get(`/api/upload/list?classroom_id=${id}`),
        API.get(`/api/quiz/list/${id}`),
        API.get(`/api/classroom/${id}/students`)
      ]);
      setClassroom(classRes.data);
      setEditName(classRes.data.name);
      setEditDescription(classRes.data.description || '');
      setPosts(postsRes.data);
      setDocuments(docsRes.data);
      setQuizzes(quizRes.data);
      setStudents(studentRes.data);
    } catch (err) {
      console.error("Error loading classroom details", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      API.get(`/api/upload/list?classroom_id=${id}`).then((res) => {
        setDocuments(res.data);
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [id]);

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

  // Support Multiple File Upload (PDF, DOCX, PPTX, TXT, MD)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(10);
    setQuizError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classroom_id', id);

        await API.post('/api/upload/document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const fileProgress = Math.round((progressEvent.loaded * 50) / progressEvent.total);
            const overallProgress = Math.round(((i * 50) + fileProgress) / files.length);
            setUploadProgress(overallProgress);
          }
        });
      }
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

  const handleGenerateQuiz = async () => {
    setGeneratingQuiz(true);
    setQuizError('');
    try {
      await API.post('/api/quiz/generate', {
        classroom_id: parseInt(id),
        num_questions: 5,
        title: `AI Practice Quiz - ${new Date().toLocaleDateString()}`
      });
      loadData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Quiz generation failed.";
      setQuizError(msg);
    } finally {
      setGeneratingQuiz(false);
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

  if (!classroom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Classroom...
      </div>
    );
  }

  const isTeacher = user?.role === 'teacher' && classroom?.teacher_id === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center space-x-1.5 text-slate-400 hover:text-white text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center space-x-3">
          {user?.role === 'student' && (
            <button
              onClick={handleLeaveClassroom}
              disabled={leaving}
              className="flex items-center space-x-1.5 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-semibold px-3 py-2 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{leaving ? 'Leaving...' : 'Leave Classroom'}</span>
            </button>
          )}

          <Link
            to={`/notebooklm?classroom_id=${id}`}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open NotebookLM AI Workspace</span>
          </Link>
        </div>
      </div>

      <TiltCard3D className="p-6 mb-8 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-900/50">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-bold text-white">{classroom.name}</h1>
              {isTeacher && (
                <button
                  onClick={handleOpenEditClassroomModal}
                  title="Edit Classroom Name & Details"
                  className="p-1.5 text-slate-400 hover:text-indigo-300 bg-slate-900/80 hover:bg-indigo-950 border border-slate-700 hover:border-indigo-600 rounded-lg transition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">{classroom.description || 'Classroom feed and study workspace'}</p>
            <p className="text-xs text-slate-500 mt-2">Instructor: {classroom.teacher_name}</p>
          </div>
          <div className="bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Class Join Code</span>
            <span className="text-base font-mono font-bold text-indigo-400 tracking-wider">{classroom.code}</span>
          </div>
        </div>
      </TiltCard3D>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed (Left 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create Post */}
          <TiltCard3D className="p-5">
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
          </TiltCard3D>

          {/* Posts Stream */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Class Feed Stream</h3>
            {posts.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
                No announcements posted yet.
              </div>
            ) : (
              posts.map((p) => (
                <TiltCard3D key={p.id} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-300">{p.author_name}</span>
                    <span className="text-[11px] text-slate-500">{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{p.content}</p>
                </TiltCard3D>
              ))
            )}
          </div>
        </div>

        {/* Sidebar (Right Col) */}
        <div className="space-y-6">
          {/* Enrolled Students List */}
          <TiltCard3D className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Enrolled Students ({students.length})</span>
              </h3>
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No students enrolled in this class yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {students.map((st) => (
                  <div key={st.id} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-3">
                    <div className="p-2 bg-indigo-950 rounded-lg text-indigo-400">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="truncate">
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
          </TiltCard3D>

          {/* Uploaded Study Notes & Documents Section */}
          <TiltCard3D className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Classroom Study Notes & Documents</span>
              </h3>
              {user?.role === 'teacher' && (
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Upload Progress Bar (0% to 100%) */}
            {uploading && (
              <div className="mb-4 bg-slate-900 p-3 rounded-xl border border-indigo-800/60">
                <div className="flex justify-between text-xs text-indigo-300 font-mono mb-1">
                  <span>Uploading Files...</span>
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
              <p className="text-xs text-slate-500 text-center py-4">No study documents uploaded yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {documents.map((doc) => {
                  const status = doc.processing_status || 'ready';
                  const isProcessing = status === 'processing';
                  const isOcrProcessing = status === 'ocr_processing';
                  const isReady = status === 'ready';
                  const progress = doc.processing_progress || 100;
                  const isDocOwner = user?.role === 'teacher' && doc.uploaded_by_id === user?.id;

                  let statusText = `OCR Ready (100%)`;
                  if (isProcessing) statusText = `Uploading (50%)`;
                  if (isOcrProcessing) statusText = `GPU OCR & Gemini AI (75%)`;

                  return (
                    <div key={doc.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-indigo-500/40 transition">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-200 font-medium truncate max-w-[150px]">{doc.filename}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isReady
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                        }`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Skeleton loader if uploading or OCR processing */}
                      {!isReady && (
                        <div className="my-2 space-y-1 animate-pulse">
                          <div className="h-2 bg-slate-800 rounded w-full"></div>
                          <div className="h-2 bg-slate-800 rounded w-3/4"></div>
                        </div>
                      )}

                      <div className="flex items-center justify-end space-x-1.5 mt-2">
                        <button
                          onClick={() => handleOpenDocumentReader(doc.id)}
                          className="flex items-center space-x-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-800 transition"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          <span>Open PDF</span>
                        </button>

                        {/* Quick Q&A Button - Disabled until OCR is 100% Ready */}
                        {isReady ? (
                          <Link
                            to={`/quick-reader?document_id=${doc.id}`}
                            className="text-[11px] bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-700 hover:bg-indigo-900 transition font-medium"
                          >
                            Quick Q&A
                          </Link>
                        ) : (
                          <button
                            disabled
                            title="Please wait until GPU OCR completes (100%)"
                            className="text-[11px] bg-slate-900 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-800 cursor-not-allowed font-mono opacity-60"
                          >
                            Quick Q&A (Processing...)
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
          </TiltCard3D>

          {/* AI Practice Quizzes Section */}
          <TiltCard3D className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>Practice Quizzes</span>
              </h3>

              {user?.role === 'teacher' && (
                <div className="flex items-center space-x-2">
                  {/* Lightning Zap Option: AI Auto-Generate Quiz */}
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz}
                    title="⚡ Lightning AI Auto-Generate Quiz"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 shadow-md"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
                    <span>{generatingQuiz ? 'Generating...' : 'AI Quiz'}</span>
                  </button>

                  {/* Plus Option: Create Manual Quiz */}
                  <button
                    onClick={() => setIsManualQuizModalOpen(true)}
                    title="➕ Create Manual Quiz"
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manual</span>
                  </button>
                </div>
              )}
            </div>

            {quizError && (
              <div className="mb-3 p-3 bg-amber-950/70 border border-amber-800/80 rounded-xl flex items-start space-x-2 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{quizError}</span>
              </div>
            )}

            {quizzes.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No practice quizzes available yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{quiz.title}</h4>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                          <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono">
                            {quiz.questions_json?.length || 5} MCQs
                          </span>
                          <span className="flex items-center space-x-1 text-slate-500">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(quiz.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
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

                    <Link
                      to={`/quiz/${quiz.id}`}
                      className="w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 rounded-lg transition shadow"
                    >
                      Attempt Quiz
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TiltCard3D>
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
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-indigo-900/80 rounded-2xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Reader Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Book className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white max-w-sm truncate">{readingDoc.filename}</h3>
                  <span className="text-[10px] text-indigo-400 uppercase font-mono">Actual PDF Document Viewer</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setViewMode('pdf')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      viewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    PDF View
                  </button>
                  <button
                    onClick={() => setViewMode('text')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      viewMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Text View
                  </button>
                </div>

                {readingDoc.processing_status === 'ready' ? (
                  <Link
                    to={`/quick-reader?document_id=${readingDoc.id}`}
                    className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask NotebookLM AI</span>
                  </Link>
                ) : (
                  <button
                    disabled
                    title="Please wait until GPU OCR completes (100%)"
                    className="flex items-center space-x-1.5 bg-slate-800 text-slate-500 text-xs font-semibold px-3.5 py-2 rounded-xl cursor-not-allowed opacity-60 font-mono"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                    <span>Ask NotebookLM AI (OCR 75%...)</span>
                  </button>
                )}

                <button
                  onClick={() => setReadingDoc(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
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
                    {readingDoc.processing_status === 'processing' || readingDoc.processing_status === 'ocr_processing' ? (
                      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-4 animate-pulse">
                        <div className="h-4 bg-slate-800 rounded w-full"></div>
                        <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                        <div className="h-4 bg-slate-800 rounded w-4/6"></div>
                        <p className="text-xs text-amber-400 font-sans mt-4">Running GPU OCR & Gemini AI Structuring (75% complete)...</p>
                      </div>
                    ) : (
                      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-inner prose prose-invert max-w-none prose-table:border prose-table:border-slate-700 prose-td:p-3 prose-th:p-3 prose-th:bg-slate-800 text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {readingDoc.content_text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
