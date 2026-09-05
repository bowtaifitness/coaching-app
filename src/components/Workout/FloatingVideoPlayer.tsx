import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Minimize2, Maximize2, GripHorizontal } from 'lucide-react';
import { useFloatingVideo } from '../../contexts/FloatingVideoContext';

export default function FloatingVideoPlayer() {
  const { videoId, title, isMinimized, closeVideo, toggleMinimize } = useFloatingVideo();
  const [position, setPosition] = useState({ x: 16, y: 80 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset position when a new video opens
  useEffect(() => {
    if (videoId) {
      setPosition({ x: 16, y: 80 });
    }
  }, [videoId]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 200);
    const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 150);
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [dragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  if (!videoId) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&autoplay=1&rel=0&modestbranding=1&controls=1`;

  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        className="fixed z-[9999] bg-gray-900 rounded-full shadow-2xl flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ left: position.x, top: position.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-white text-xs font-medium truncate max-w-[120px]">
          {title || 'Playing'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
          className="text-white hover:text-blue-400 transition-colors ml-1"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); closeVideo(); }}
          className="text-white hover:text-red-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] shadow-2xl rounded-xl overflow-hidden border border-gray-700/50 select-none touch-none"
      style={{
        left: position.x,
        top: position.y,
        width: 'min(320px, calc(100vw - 32px))',
      }}
    >
      {/* Drag handle */}
      <div
        className="bg-gray-900 flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-white text-xs font-medium truncate">
            {title || 'Exercise Demo'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={toggleMinimize}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closeVideo}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Video */}
      <div className="aspect-video bg-black">
        <iframe
          className="w-full h-full"
          src={embedUrl}
          title="Exercise Demo"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
