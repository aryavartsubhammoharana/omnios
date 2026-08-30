import React from 'react';
import { Sparkles, FileText, CheckCircle2, Info, X } from 'lucide-react';

export default function LiveToast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const icons = {
    info: <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    sparkle: <Sparkles className="w-4 h-4 text-indigo-400 animate-spin-slow flex-shrink-0" />,
    doc: <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-slide-up transition-all duration-300 max-w-sm pointer-events-auto">
      <div className="bg-[#0e1320]/95 backdrop-blur-xl border border-indigo-500/30 text-gray-200 px-4 py-3 rounded-2xl shadow-2xl shadow-indigo-950/80 flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          {icons[type] || icons.sparkle}
        </div>
        <div className="flex-1 text-xs leading-snug font-medium text-gray-200">
          {message}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
