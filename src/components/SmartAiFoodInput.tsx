import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, X } from 'lucide-react';

interface SmartAiFoodInputProps {
  value: string;
  onChange: (val: string) => void;
  onRawChange?: (val: string) => void;
  onSubmit: (val: string) => void;
  onClear: () => void;
  isListening: boolean;
  speechSupported: boolean;
  onToggleSpeech: () => void;
  placeholder?: string;
}

export const SmartAiFoodInput: React.FC<SmartAiFoodInputProps> = ({
  value: externalValue,
  onChange,
  onRawChange,
  onSubmit,
  onClear,
  isListening,
  speechSupported,
  onToggleSpeech,
  placeholder = "Type or speak: 89g mango, 2 eggs and toast, 1 pack Doritos, 1 can Coke Zero, or paste a recipe..."
}) => {
  const [localText, setLocalText] = useState(externalValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes (e.g. speech to text or modal reset)
  useEffect(() => {
    setLocalText(externalValue);
  }, [externalValue]);

  // Debounce notification to parent (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localText);
    }, 400);
    return () => clearTimeout(timer);
  }, [localText, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setLocalText(nextVal);
    if (onRawChange) {
      onRawChange(nextVal);
    }
  };

  const handleClear = () => {
    setLocalText('');
    if (onRawChange) {
      onRawChange('');
    }
    onClear();
  };

  return (
    <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-3 focus-within:border-teal-500 transition-colors shadow-inner">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Smart AI Food Input</span>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSpeech}
            disabled={!speechSupported}
            title={
              speechSupported
                ? isListening
                  ? 'Listening... tap to stop'
                  : 'Tap to speak food description'
                : 'Speech recognition not supported in this browser'
            }
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse'
                : speechSupported
                ? 'text-zinc-400 hover:text-teal-300 hover:bg-zinc-800'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            aria-label="Speech to text"
          >
            {isListening ? (
              <>
                <Mic className="w-3.5 h-3.5 animate-bounce" />
                <span className="text-[10px] font-semibold">Listening...</span>
              </>
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>

          {localText.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear input"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        rows={3}
        value={localText}
        onChange={handleChange}
        onFocus={(e) => {
          // Prevent browser scrolling jump on focus
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(localText);
          }
        }}
        placeholder={placeholder}
        style={{ scrollMarginTop: '120px' }}
        className="food-input w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed"
      />
    </div>
  );
};
