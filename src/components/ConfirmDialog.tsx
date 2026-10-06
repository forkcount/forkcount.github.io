import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  secondStepLabel?: string;
  twoStep?: boolean;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Continue',
  secondStepLabel = 'Confirm Delete',
  twoStep = true,
  isDestructive = true,
  onConfirm,
  onCancel,
  onClose
}) => {
  const handleDismiss = onCancel || onClose || (() => {});
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
              {twoStep && (
                <span className="text-[10px] font-mono text-zinc-400">
                  Step {step} of 2
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close confirmation dialog"
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          {step === 1
            ? description
            : 'Are you completely sure? Please confirm once more to proceed.'}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
          {twoStep && step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                isDestructive
                  ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
              }`}
            >
              {confirmLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                isDestructive
                  ? 'bg-red-500 hover:bg-red-400 text-zinc-950'
                  : 'bg-teal-500 hover:bg-teal-400 text-zinc-950'
              }`}
            >
              {twoStep ? secondStepLabel : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
