import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { HelpCircle, CheckCircle, XCircle, ArrowLeft, Award, RotateCcw, Lock, Sparkles, AlertCircle } from 'lucide-react';
import TiltCard3D from '../components/TiltCard3D';

export default function QuizAttempt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [quiz, setQuiz] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [attemptResult, setAttemptResult] = useState(null);
  const [officialAttempt, setOfficialAttempt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);

  useEffect(() => {
    // 1. Fetch Quiz Content
    API.get(`/api/quiz/${id}`)
      .then((res) => setQuiz(res.data))
      .catch((err) => console.error("Quiz fetch failed", err));

    // 2. Fetch Existing Official First Attempt (if any)
    API.get(`/api/quiz/attempts/${id}`)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const firstAtt = res.data[0];
          setOfficialAttempt(firstAtt);
          setAttemptResult(firstAtt);
          // Pre-populate selections from first attempt
          if (firstAtt.answers_json) {
            const prefill = {};
            Object.entries(firstAtt.answers_json).forEach(([qId, ans]) => {
              if (ans && ans.chosen !== undefined && ans.chosen !== null) {
                prefill[qId] = ans.chosen;
              }
            });
            setSelectedAnswers(prefill);
          }
        }
      })
      .catch((err) => console.error("Attempts fetch failed", err));
  }, [id]);

  const handleSelectOption = (questionId, optionIdx) => {
    if (attemptResult) return; // Locked once current attempt is submitted
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx
    }));
  };

  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    try {
      const res = await API.post('/api/quiz/submit', {
        quiz_id: parseInt(id),
        user_answers: selectedAnswers
      });
      setAttemptResult(res.data);
      if (res.data.is_first_attempt) {
        setOfficialAttempt(res.data);
      }
    } catch (err) {
      console.error("Submit quiz failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartPracticeRetake = () => {
    setIsPracticeMode(true);
    setAttemptResult(null);
    setSelectedAnswers({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading Quiz...
      </div>
    );
  }

  const questions = quiz.questions_json || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-semibold mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Classroom</span>
      </button>

      {/* Header Card */}
      <TiltCard3D className="p-6 mb-6 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              <span>{quiz.title}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">{quiz.description}</p>
          </div>

          {attemptResult && (
            <div className="bg-indigo-950 border border-indigo-700 px-5 py-2.5 rounded-xl text-center shadow-lg">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">
                {attemptResult.is_first_attempt === false ? 'Practice Score' : 'Official Grade'}
              </span>
              <span className="text-2xl font-bold text-indigo-300">
                {attemptResult.score} / {attemptResult.max_score}
              </span>
            </div>
          )}
        </div>
      </TiltCard3D>

      {/* Official Score Lock Banner */}
      {officialAttempt && (
        <div className="mb-6 p-4 rounded-xl border bg-slate-900/90 border-indigo-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">
                Official First Attempt: <span className="text-indigo-300 font-mono">{officialAttempt.score} / {officialAttempt.max_score} ({Math.round((officialAttempt.score/officialAttempt.max_score)*100)}%)</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permanently locked for teacher evaluation. Any retakes are for your personal practice.
              </p>
            </div>
          </div>

          {attemptResult && (
            <button
              onClick={handleStartPracticeRetake}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Practice Retake</span>
            </button>
          )}
        </div>
      )}

      {/* Practice Sandbox Alert */}
      {attemptResult && attemptResult.is_first_attempt === false && (
        <div className="mb-6 p-4 rounded-xl border bg-amber-950/40 border-amber-800/60 flex items-center space-x-3 text-xs text-amber-300">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Practice Sandbox Run:</strong> You scored {attemptResult.score}/{attemptResult.max_score} on this practice round. Your Official Grade ({officialAttempt?.score}/{officialAttempt?.max_score}) remains preserved in the gradebook.
          </span>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const qId = q.id || idx + 1;
          const chosenOpt = selectedAnswers[qId];
          const resultItem = attemptResult?.answers_json?.[String(qId)] || attemptResult?.answers_json?.[qId];

          return (
            <TiltCard3D key={idx} className="p-6">
              <h3 className="text-sm font-bold text-white mb-4">
                <span className="text-indigo-400 font-mono mr-2">Q{idx + 1}.</span>
                {q.question_text || q.question}
              </h3>

              <div className="space-y-2.5">
                {q.options?.map((opt, optIdx) => {
                  const isSelected = chosenOpt === optIdx;
                  let optStyle = "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-indigo-500/50";
                  
                  if (attemptResult) {
                    const isCorrect = q.correct_index === optIdx;
                    if (isCorrect) {
                      optStyle = "bg-emerald-950/60 border-emerald-600 text-emerald-300 font-semibold";
                    } else if (isSelected && !isCorrect) {
                      optStyle = "bg-red-950/60 border-red-600 text-red-300";
                    }
                  } else if (isSelected) {
                    optStyle = "bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold shadow-lg shadow-indigo-500/10";
                  }

                  const optLetter = ["A", "B", "C", "D"][optIdx] || String(optIdx + 1);

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={!!attemptResult}
                      onClick={() => handleSelectOption(qId, optIdx)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs transition flex items-center justify-between ${optStyle} ${
                        attemptResult ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[11px] font-bold ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {optLetter}
                        </span>
                        <span>{opt}</span>
                      </div>

                      {attemptResult && q.correct_index === optIdx && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {attemptResult && q.explanation && (
                <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                  <span className="font-semibold text-indigo-400 block mb-1">Explanation:</span>
                  {q.explanation}
                </div>
              )}
            </TiltCard3D>
          );
        })}
      </div>

      {/* Submit / Retake Action Button */}
      {!attemptResult ? (
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmitQuiz}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition shadow-xl shadow-indigo-600/30 flex items-center space-x-2"
          >
            <Award className="w-4 h-4" />
            <span>{submitting ? 'Submitting...' : (officialAttempt ? 'Submit Practice Run' : 'Submit Official Answers')}</span>
          </button>
        </div>
      ) : (
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
          >
            Return to Classroom
          </button>
          <button
            onClick={handleStartPracticeRetake}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake for Practice</span>
          </button>
        </div>
      )}
    </div>
  );
}
