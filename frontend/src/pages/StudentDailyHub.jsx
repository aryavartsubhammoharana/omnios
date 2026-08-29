import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { 
  Sparkles, CheckCircle2, XCircle, Play, Flame, Award, Clock,
  BookOpen, ChevronRight, AlertTriangle, ArrowRight, Video,
  RotateCcw, Loader2, Target, RefreshCw, Search
} from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

export default function StudentDailyHub() {
  const navigate = useNavigate();
  const [dailyQuiz, setDailyQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [streak, setStreak] = useState(1);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchingVideos, setSearchingVideos] = useState(false);
  const [customSearchResults, setCustomSearchResults] = useState(null);

  const fetchDailyQuiz = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/student/daily-quiz');
      setDailyQuiz(res.data);
      if (res.data.is_completed) {
        setSubmissionResult({
          score: res.data.score,
          max_score: res.data.max_score,
          percentage: roundPct(res.data.score, res.data.max_score),
          weak_topics: res.data.weak_topics || [],
          recommendations: res.data.recommendations || [],
          detailed_answers: res.data.user_answers || {}
        });
      }
    } catch (err) {
      console.error('Error fetching daily quiz', err);
    } finally {
      setLoading(false);
    }
  };

  const roundPct = (sc, maxSc) => {
    if (!maxSc || maxSc === 0) return 0;
    return Math.round((sc / maxSc) * 100);
  };

  useEffect(() => {
    fetchDailyQuiz();
    API.get('/api/analytics/my-streak').then(res => {
      if (res.data?.current_streak) setStreak(res.data.current_streak);
    }).catch(() => {});
  }, []);

  const handleSelectOption = (questionId, optionIdx) => {
    if (dailyQuiz?.is_completed || submissionResult) return;
    setUserAnswers(prev => ({
      ...prev,
      [String(questionId)]: optionIdx
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!dailyQuiz || submitting) return;
    const questions = dailyQuiz.questions || [];
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < questions.length) {
      if (!window.confirm(`You answered ${answeredCount} of ${questions.length} questions. Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await API.post('/api/student/daily-quiz/submit', {
        quiz_id: dailyQuiz.id,
        user_answers: userAnswers
      });
      setSubmissionResult(res.data);
      if (res.data.streak) setStreak(res.data.streak);
      setDailyQuiz(prev => ({ ...prev, is_completed: true }));
      setCustomSearchResults(null);
    } catch (err) {
      console.error('Error submitting quiz', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshRecommendations = async () => {
    setRefreshing(true);
    setCustomSearchResults(null);
    try {
      const res = await API.post('/api/student/refresh-recommendations');
      const newRecs = res.data.recommendations || [];
      if (submissionResult) {
        setSubmissionResult(prev => ({ ...prev, recommendations: newRecs }));
      } else {
        setDailyQuiz(prev => ({ ...prev, recommendations: newRecs }));
      }
    } catch (err) {
      console.error('Error refreshing recommendations', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCustomSearch = async (e) => {
    e.preventDefault();
    if (!customSearchQuery.trim() || searchingVideos) return;
    setSearchingVideos(true);
    try {
      const res = await API.get('/api/student/search-videos', {
        params: { q: customSearchQuery.trim() }
      });
      setCustomSearchResults(res.data.results || []);
    } catch (err) {
      console.error('Error searching educational videos', err);
    } finally {
      setSearchingVideos(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-61px)] bg-[#090d16] flex items-center justify-center text-indigo-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isCompleted = dailyQuiz?.is_completed || !!submissionResult;
  const questions = dailyQuiz?.questions || [];
  const baseRecommendations = submissionResult?.recommendations || dailyQuiz?.recommendations || [];
  const displayedVideos = customSearchResults !== null ? customSearchResults : baseRecommendations;
  const weakTopics = submissionResult?.weak_topics || dailyQuiz?.weak_topics || [];

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>Autonomous AI Assessment</span>
              </span>
              <span className="text-[11px] text-gray-400 font-mono">Refreshes every 24 Hours</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {dailyQuiz?.title || "Daily AI Diagnostic Practice"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl">
              Personalized diagnostic test generated automatically from your enrolled classroom lecture notes to pinpoint weak topics and recommend curated video masterclasses.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-gray-900/90 border border-gray-800 p-3.5 rounded-2xl shadow-inner shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-gray-400 block">Daily Streak</span>
                <span className="text-base font-extrabold text-white font-mono">{streak} Days 🔥</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6 rounded-3xl border border-gray-800/80 shadow-xl bg-gray-950/80">
          <form onSubmit={handleCustomSearch} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customSearchQuery}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                placeholder="Search any academic concept, formula or topic for instant distraction-free lectures..."
                className="w-full pl-11 pr-4 py-3 bg-gray-900/90 border border-gray-800 rounded-2xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={searchingVideos || !customSearchQuery.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition shrink-0"
            >
              {searchingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{searchingVideos ? 'Searching...' : 'Search Lectures'}</span>
            </button>
            {customSearchResults !== null && (
              <button
                type="button"
                onClick={() => {
                  setCustomSearchResults(null);
                  setCustomSearchQuery('');
                }}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition shrink-0"
              >
                Clear Search
              </button>
            )}
          </form>
        </div>

        {(isCompleted || customSearchResults !== null) && (
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-indigo-900/50 bg-gradient-to-r from-indigo-950/40 via-gray-900 to-purple-950/40 shadow-2xl space-y-6">
            {isCompleted && submissionResult && customSearchResults === null && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xl font-mono shadow-inner">
                    {submissionResult.percentage}%
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      <span>Diagnostic Result: {submissionResult.score} / {submissionResult.max_score}</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Completed on {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • +300 Study Seconds Earned
                    </p>
                  </div>
                </div>

                {weakTopics.length > 0 && (
                  <div className="bg-gray-900/90 border border-red-900/40 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] uppercase text-red-400 font-mono block font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Identified Focus Areas</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {weakTopics.map((t, idx) => (
                        <span key={idx} className="text-[11px] bg-red-950/60 text-red-300 border border-red-800/60 px-2 py-0.5 rounded-lg font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {displayedVideos.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Video className="w-5 h-5 text-red-400" />
                    <h3 className="text-base font-bold text-white">
                      {customSearchResults !== null 
                        ? `Search Results for "${customSearchQuery}" (${displayedVideos.length} Lectures)`
                        : 'Top 10 Curated Lecture Videos (Focus Mode)'}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-400 hidden md:inline">Strictly Academic • No Shorts</span>
                    <button
                      onClick={handleRefreshRecommendations}
                      disabled={refreshing}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-indigo-300 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>{refreshing ? 'Refreshing...' : 'Refresh Videos'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedVideos.map((vid, idx) => (
                    <div 
                      key={idx}
                      className="glass-panel p-3.5 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition duration-300 flex flex-col justify-between group"
                    >
                      <div>
                        <div className="relative rounded-xl overflow-hidden mb-3 aspect-video bg-gray-900">
                          <img 
                            src={vid.thumbnail_url} 
                            alt={vid.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </div>
                          {vid.weak_topic && (
                            <span className="absolute bottom-2 left-2 text-[9px] bg-black/80 backdrop-blur-md text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-md font-mono">
                              {vid.weak_topic}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-snug group-hover:text-indigo-300 transition">
                          {vid.title}
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-1">{vid.channel_title}</p>
                      </div>

                      <button
                        onClick={() => navigate(`/student/focus-video/${vid.video_id}?topic=${encodeURIComponent(vid.weak_topic || '')}&title=${encodeURIComponent(vid.title)}`)}
                        className="mt-3 w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-md shadow-indigo-600/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch in Focus Mode</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800/80 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>{isCompleted ? "Diagnostic Review & Explanations" : "Diagnostic Questions"}</span>
            </h3>
            <span className="text-xs text-gray-400 font-mono">
              {questions.length} Multiple Choice Questions
            </span>
          </div>

          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const qId = String(q.id || qIdx + 1);
              const selectedOpt = isCompleted 
                ? submissionResult?.detailed_answers?.[qId]?.chosen 
                : userAnswers[qId];
              const correctOpt = isCompleted 
                ? submissionResult?.detailed_answers?.[qId]?.correct 
                : q.correct_index;
              const isAnsCorrect = isCompleted 
                ? submissionResult?.detailed_answers?.[qId]?.is_correct 
                : null;

              return (
                <div 
                  key={qId}
                  className={`p-5 rounded-2xl border transition ${
                    isCompleted 
                      ? isAnsCorrect
                        ? 'bg-emerald-950/20 border-emerald-800/60'
                        : 'bg-red-950/20 border-red-800/60'
                      : 'bg-gray-900/60 border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 rounded-lg bg-gray-800 text-gray-300 font-mono text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {qIdx + 1}
                      </span>
                      <div className="text-xs sm:text-sm font-semibold text-gray-100 leading-relaxed">
                        <MathRenderer content={q.question} />
                      </div>
                    </div>
                    {q.topic && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-gray-800/80 text-indigo-300 border border-gray-700 shrink-0">
                        {q.topic}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {q.options.map((opt, optIdx) => {
                      const isChosen = selectedOpt !== undefined && selectedOpt !== null && Number(selectedOpt) === optIdx;
                      const isActualCorrect = isCompleted && Number(correctOpt) === optIdx;

                      let optStyles = "bg-gray-900/90 border-gray-800 text-gray-300 hover:bg-gray-800 hover:border-gray-700";

                      if (isCompleted) {
                        if (isActualCorrect) {
                          optStyles = "bg-emerald-900/40 border-emerald-600 text-emerald-200 font-bold";
                        } else if (isChosen && !isActualCorrect) {
                          optStyles = "bg-red-900/40 border-red-600 text-red-200";
                        } else {
                          optStyles = "bg-gray-900/40 border-gray-800/60 text-gray-500 opacity-60";
                        }
                      } else if (isChosen) {
                        optStyles = "bg-indigo-600 text-white font-bold border-indigo-500 shadow-md";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isCompleted}
                          onClick={() => handleSelectOption(qId, optIdx)}
                          className={`p-3 rounded-xl border text-xs text-left transition flex items-center space-x-2.5 ${optStyles}`}
                        >
                          <span className="w-5 h-5 rounded-md border border-current/30 flex items-center justify-center text-[10px] font-mono shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">
                            <MathRenderer content={opt} />
                          </span>
                          {isCompleted && isActualCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {isCompleted && isChosen && !isActualCorrect && (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isCompleted && q.explanation && (
                    <div className="mt-3.5 pt-3 border-t border-gray-800/60 text-[11px] text-gray-300 flex items-start space-x-2">
                      <span className="font-bold text-indigo-300 shrink-0 font-mono">💡 Explanation:</span>
                      <div className="flex-1 text-gray-300">
                        <MathRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isCompleted && (
            <div className="pt-4 flex justify-end">
              <button
                disabled={submitting}
                onClick={handleSubmitQuiz}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Diagnosing Performance & Fetching Videos...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Diagnostic Quiz</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
