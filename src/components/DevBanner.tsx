import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export const DevBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-rose-950/80 border-b border-rose-900/60 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-[90%]">
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="font-medium tracking-wide">
          Not Ready Yet — early development version. Data syncs to live database.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-rose-900/60 rounded text-rose-400 hover:text-rose-100 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
