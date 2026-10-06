import React, { useState, useEffect } from 'react';
import { Lock, Clock, Sparkles, Award, X, Keyboard } from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { formatWeight } from '../utils/nutritionMath.js';

export const GuestLockSheet: React.FC = () => {
  const { isGuestLockOpen, closeGuestLock, openAuthModal } = useApp();

  if (!isGuestLockOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="font-display text-lg font-semibold text-zinc-100">
            Create an account to use this
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-zinc-300">
          Your data is saved on this device. Sign up to keep it, sync it across devices, and unlock reports, weight tracking, meal plans, and more.
        </p>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              closeGuestLock();
              openAuthModal();
            }}
            aria-label="Create account"
            className="flex-1 min-h-[44px] bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs transition-colors"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={closeGuestLock}
            aria-label="Not now"
            className="flex-1 min-h-[44px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-xs transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

export const GuestExpiredOverlay: React.FC = () => {
  const { isGuestExpired, openAuthModal, resetGuestSession } = useApp();

  if (!isGuestExpired) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-md flex items-center justify-center p-6">
      <div className="surface max-w-md w-full p-8 text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
          <Clock className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold text-zinc-100">
            Guest Session Ended
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Your guest session has ended. Create an account to keep your data, or start fresh.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => openAuthModal()}
            aria-label="Create account"
            className="flex-1 min-h-[44px] bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs transition-colors"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={resetGuestSession}
            aria-label="Start fresh"
            className="flex-1 min-h-[44px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition-colors"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
};

const TIPS_DONE_KEY = 'caloriq_first_run_tips_done';
const ONBOARDING_KEY = 'caloriq_onboarding_completed';

export const FirstRunTooltips: React.FC = () => {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const onboardingDone = localStorage.getItem(ONBOARDING_KEY) === 'true';
      const tipsDone = localStorage.getItem(TIPS_DONE_KEY) === 'true';
      if (onboardingDone && !tipsDone && step === null) {
        setStep(0);
      }
    };
    check();
    const interval = window.setInterval(check, 800);
    return () => window.clearInterval(interval);
  }, [step]);

  if (step === null || step > 2) return null;

  const tips = [
    'Tap here to log your first meal',
    'Tap a glass to track water',
    'Log something to start your streak.'
  ];

  const handleTap = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      localStorage.setItem(TIPS_DONE_KEY, 'true');
      setStep(3);
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-xs w-[90%]">
      <button
        type="button"
        onClick={handleTap}
        aria-label={tips[step]}
        className="w-full min-h-[44px] bg-teal-500 text-zinc-950 px-4 py-3 rounded-xl shadow-2xl border border-teal-300 flex items-center justify-between gap-3 text-left transition-all"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{tips[step]}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider opacity-80 shrink-0">
          {step + 1}/3 · Tap
        </span>
      </button>
    </div>
  );
};

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'N', desc: 'Add Food' },
    { key: 'W', desc: 'Log water (+1 glass)' },
    { key: 'E', desc: 'Open exercise log' },
    { key: '?', desc: 'Show keyboard shortcuts' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts list"
            className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs"
            >
              <span className="text-zinc-300">{s.desc}</span>
              <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-teal-300 font-mono font-bold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MilestoneConfettiModal: React.FC = () => {
  const { milestoneCelebration, dismissMilestone, profile } = useApp();

  if (!milestoneCelebration) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-teal-500/50 rounded-2xl max-w-xs w-full p-6 text-center shadow-2xl space-y-4 relative overflow-hidden">
        <div className="flex justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </div>

        <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
          <Award className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 block">
            Milestone Reached
          </span>
          <h3 className="font-display text-3xl font-bold text-zinc-100 font-mono">
            {formatWeight(milestoneCelebration, profile.unitSystem)}
          </h3>
          <p className="text-xs text-zinc-300">
            Total weight change recorded since your first weigh-in.
          </p>
        </div>

        <button
          type="button"
          onClick={dismissMilestone}
          aria-label="Dismiss milestone celebration"
          className="w-full min-h-[44px] bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
