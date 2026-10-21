import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, X, CheckCircle } from 'lucide-react';

interface ApologyModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ApologyModal: React.FC<ApologyModalProps> = ({ isOpen: propIsOpen, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (propIsOpen !== undefined) {
      setIsOpen(propIsOpen);
      return;
    }
    const seen = localStorage.getItem('forkcount_apology_seen');
    if (!seen) {
      setIsOpen(true);
    }
  }, [propIsOpen]);

  const handleDismiss = () => {
    localStorage.setItem('forkcount_apology_seen', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Welcome to Upgraded ForkCount</h3>
              <p className="text-xs text-teal-400 font-medium">System Update &amp; Authentication Notice</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
          <p>
            We sincerely apologize for any recent interruptions or discrepancies you may have experienced while accessing ForkCount.
          </p>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
              <Sparkles className="size-3.5 text-teal-400" />
              <span>What has been upgraded:</span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-zinc-400 text-[11px]">
              <li>Real-time cloud database syncing is faster and fully restored.</li>
              <li>Support for real email verification, password recovery, and Google / Facebook login.</li>
              <li>Your nutrition targets, macros, weights, and diary history are safe and preserved.</li>
            </ul>
          </div>
          <p className="text-[11px] text-zinc-400">
            Thank you for your patience and support as we build the cleanest, fastest calorie and nutrition tracker for you.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-xs font-bold text-zinc-950 shadow-md shadow-teal-500/20 hover:bg-teal-400 transition-all active:scale-[0.98]"
        >
          <CheckCircle className="size-4" />
          <span>Got it, let&apos;s track</span>
        </button>
      </div>
    </div>
  );
};
