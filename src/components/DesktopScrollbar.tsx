import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const DesktopScrollbar: React.FC = () => {
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
    isScrollable: false
  });
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartScrollTop = useRef<number>(0);

  const updateScrollMetrics = useCallback(() => {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight, 1);
    const clientHeight = window.innerHeight || doc.clientHeight || 1;
    const isScrollable = scrollHeight > clientHeight + 8;

    setScrollState({
      scrollTop,
      scrollHeight,
      clientHeight,
      isScrollable
    });
  }, []);

  useEffect(() => {
    updateScrollMetrics();
    window.addEventListener('scroll', updateScrollMetrics, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);

    const observer = new ResizeObserver(() => {
      updateScrollMetrics();
    });
    observer.observe(document.body);
    observer.observe(document.documentElement);

    const interval = setInterval(updateScrollMetrics, 600);

    return () => {
      window.removeEventListener('scroll', updateScrollMetrics);
      window.removeEventListener('resize', updateScrollMetrics);
      observer.disconnect();
      clearInterval(interval);
    };
  }, [updateScrollMetrics]);

  const { scrollTop, scrollHeight, clientHeight, isScrollable } = scrollState;
  const maxScroll = Math.max(1, scrollHeight - clientHeight);
  const thumbRatio = Math.max(0.08, Math.min(1, clientHeight / scrollHeight));
  const thumbHeightPercent = thumbRatio * 100;
  const scrollProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
  const thumbTopPercent = scrollProgress * (100 - thumbHeightPercent);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || isDragging) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    const targetScroll = ratio * (scrollHeight - clientHeight) - clientHeight * 0.25;
    window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = window.scrollY || document.documentElement.scrollTop || 0;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const trackHeight = trackRef.current.getBoundingClientRect().height;
      const availableTrack = Math.max(1, trackHeight * (1 - thumbRatio));
      const deltaY = e.clientY - dragStartY.current;
      const scrollDelta = (deltaY / availableTrack) * maxScroll;
      window.scrollTo({
        top: Math.max(0, Math.min(maxScroll, dragStartScrollTop.current + scrollDelta)),
        behavior: 'auto'
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, maxScroll, thumbRatio]);

  const scrollByStep = (direction: 'up' | 'down') => {
    const amount = direction === 'up' ? -Math.round(clientHeight * 0.65) : Math.round(clientHeight * 0.65);
    window.scrollBy({ top: amount, behavior: 'smooth' });
  };

  if (!isScrollable) return null;

  return (
    <div
      className="fixed right-2 top-16 bottom-16 z-50 flex flex-col items-center select-none gap-1"
      aria-label="Page Scrollbar"
    >
      <button
        type="button"
        onClick={() => scrollByStep('up')}
        title="Scroll Up"
        className="w-5 h-5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-teal-400 flex items-center justify-center shadow-md transition-colors cursor-pointer"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative flex-1 w-3.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-inner cursor-pointer overflow-hidden"
        title="Click or drag to scroll"
      >
        <div
          onMouseDown={handleThumbMouseDown}
          style={{
            height: `${thumbHeightPercent}%`,
            top: `${thumbTopPercent}%`
          }}
          className={`absolute left-0.5 right-0.5 rounded-full transition-colors cursor-grab active:cursor-grabbing ${
            isDragging
              ? 'bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.6)]'
              : 'bg-teal-500/80 hover:bg-teal-400'
          }`}
        />
      </div>

      <button
        type="button"
        onClick={() => scrollByStep('down')}
        title="Scroll Down"
        className="w-5 h-5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-teal-400 flex items-center justify-center shadow-md transition-colors cursor-pointer"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
