import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import API from '../api/client';
import { 
  ArrowLeft, Play, Pause, RotateCcw, RotateCw, Maximize2, 
  Clock, Flame, FileText, Sparkles, Check, Loader2, Volume2, ShieldCheck
} from 'lucide-react';

export default function FocusVideoPlayer() {
  const { videoId } = useParams();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get('topic') || '';
  const initialTitle = searchParams.get('title') || 'Educational Masterclass';

  const [transcript, setTranscript] = useState([]);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;
    setLoadingTranscript(true);
    API.get(`/api/student/video-transcript/${videoId}`)
      .then(res => {
        setTranscript(res.data?.transcript || []);
      })
      .catch(err => {
        console.warn('Transcript loading error', err);
      })
      .finally(() => {
        setLoadingTranscript(false);
      });
  }, [videoId]);

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveSeconds(prev => {
          const next = prev + 1;
          if (next > 0 && next % 30 === 0) {
            API.post('/api/student/track-video-focus', {
              video_id: videoId,
              video_title: initialTitle,
              weak_topic: topic,
              watch_seconds: 30
            }).catch(() => {});
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, videoId, initialTitle, topic]);

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeekTo = (seconds) => {
    if (playerRef.current && playerRef.current.contentWindow) {
      playerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
        '*'
      );
    }
  };

  const filteredTranscript = transcript.filter(t => 
    !searchQuery || t.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-61px)] bg-[#090d16] text-gray-100 flex flex-col overflow-hidden relative">
      <header className="bg-gray-950/90 backdrop-blur-md border-b border-gray-800/80 px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center space-x-4">
          <Link to="/student/daily-hub" className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Back to Recommendations</span>
          </Link>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-red-400" />
              <span>Distraction-Free Focus Mode</span>
            </span>
            {topic && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800 font-mono">
                {topic}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gray-900/90 border border-gray-800 px-3.5 py-1.5 rounded-xl text-xs font-mono shadow-inner">
            <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-gray-400 text-[10px] uppercase font-semibold">Active Focus:</span>
            <span className="text-emerald-400 font-bold">{formatSeconds(activeSeconds)}</span>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              isPlaying 
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30'
                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause Tracker' : 'Resume Tracker'}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <div className="lg:col-span-8 bg-black h-full flex flex-col justify-center items-center relative overflow-hidden">
          <iframe
            ref={playerRef}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1&autoplay=1`}
            title={initialTitle}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>

        <div className="lg:col-span-4 bg-[#090d16]/95 border-l border-gray-800/80 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-800/80 bg-gray-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-gray-200">Interactive Lecture Transcript</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              {transcript.length} lines
            </span>
          </div>

          <div className="p-3 border-b border-gray-800/60 flex-shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts in transcript..."
              className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-2.5 font-sans text-xs">
            {loadingTranscript ? (
              <div className="flex items-center justify-center h-48 text-indigo-400 space-x-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading interactive subtitles...</span>
              </div>
            ) : filteredTranscript.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                No transcript subtitles available for this video. You can still watch and track active focus time.
              </div>
            ) : (
              filteredTranscript.map((line, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSeekTo(line.start)}
                  className="p-2.5 rounded-xl border border-gray-800/60 bg-gray-900/40 hover:bg-gray-800/80 hover:border-indigo-500/50 transition cursor-pointer flex items-start space-x-3 group"
                >
                  <span className="font-mono text-[10px] text-indigo-400 group-hover:text-indigo-300 bg-gray-950 px-2 py-0.5 rounded border border-gray-800 shrink-0 mt-0.5">
                    {formatSeconds(Math.floor(line.start))}
                  </span>
                  <p className="text-gray-300 group-hover:text-white leading-relaxed text-xs">
                    {line.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
