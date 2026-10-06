import React, { useState, useRef } from 'react';
import { Trash2, Copy, MoreHorizontal, X } from 'lucide-react';

export interface SwipeOption {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeLeftDelete?: () => void;
  onDelete?: () => void;
  onSwipeRightDuplicate?: () => void;
  onDuplicateToToday?: () => void;
  duplicateLabel?: string;
  options?: SwipeOption[];
  itemTitle?: string;
  className?: string;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onSwipeLeftDelete,
  onDelete,
  onSwipeRightDuplicate,
  onDuplicateToToday,
  duplicateLabel = 'Duplicate to Today',
  options = [],
  itemTitle = 'Item Options',
  className = ''
}) => {
  const effectiveDelete = onSwipeLeftDelete || onDelete;
  const effectiveDuplicate = onSwipeRightDuplicate || onDuplicateToToday;
  const [offsetX, setOffsetX] = useState(0);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const swipingRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    swipingRef.current = false;

    if (options.length > 0 || effectiveDelete || effectiveDuplicate) {
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        if (!swipingRef.current) {
          setShowOptionsModal(true);
        }
      }, 550);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearLongPress();
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      swipingRef.current = true;
      if (dx < 0 && effectiveDelete) {
        setOffsetX(Math.max(-96, dx));
      } else if (dx > 0 && effectiveDuplicate) {
        setOffsetX(Math.min(96, dx));
      }
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    if (offsetX <= -64 && effectiveDelete) {
      setOffsetX(0);
      effectiveDelete();
    } else if (offsetX >= 64 && effectiveDuplicate) {
      setOffsetX(0);
      effectiveDuplicate();
    } else {
      setOffsetX(0);
    }
    startXRef.current = null;
    startYRef.current = null;
    swipingRef.current = false;
  };

  const combinedOptions: SwipeOption[] = [
    ...options,
    ...(effectiveDuplicate
      ? [{ label: duplicateLabel, onClick: effectiveDuplicate }]
      : []),
    ...(effectiveDelete
      ? [{ label: 'Delete', onClick: effectiveDelete, destructive: true }]
      : [])
  ];

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      {/* Background swipe indicators */}
      {offsetX < -8 && effectiveDelete && (
        <div className="absolute inset-y-0 right-0 w-24 bg-red-500/20 border-l border-red-500/40 flex items-center justify-center text-red-400 text-[10px] font-bold gap-1 rounded-r-xl">
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </div>
      )}
      {offsetX > 8 && effectiveDuplicate && (
        <div className="absolute inset-y-0 left-0 w-28 bg-teal-500/20 border-r border-teal-500/40 flex items-center justify-center text-teal-300 text-[10px] font-bold gap-1 rounded-l-xl">
          <Copy className="w-3.5 h-3.5" />
          <span>Duplicate</span>
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          if (combinedOptions.length > 0) {
            e.preventDefault();
            setShowOptionsModal(true);
          }
        }}
        className={`transition-transform duration-150 ${
          offsetX === 0 ? 'translate-x-0' : offsetX < 0 ? '-translate-x-12' : 'translate-x-12'
        }`}
      >
        {children}
      </div>

      {showOptionsModal && combinedOptions.length > 0 && (
        <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-4 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-200 truncate">{itemTitle}</span>
              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                aria-label="Close item options"
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 pt-1">
              {combinedOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setShowOptionsModal(false);
                    opt.onClick();
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${
                    opt.destructive
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                      : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  <MoreHorizontal className="w-3.5 h-3.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
