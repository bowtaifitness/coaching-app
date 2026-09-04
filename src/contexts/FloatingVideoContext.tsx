import React, { createContext, useContext, useState, useCallback } from 'react';

interface FloatingVideoState {
  videoId: string | null;
  title: string;
}

interface FloatingVideoContextType {
  videoId: string | null;
  title: string;
  isMinimized: boolean;
  openVideo: (videoId: string, title?: string) => void;
  closeVideo: () => void;
  toggleMinimize: () => void;
}

const FloatingVideoContext = createContext<FloatingVideoContextType | null>(null);

function isNative(): boolean {
  try {
    return (window as any).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

async function openNativeBrowser(videoId: string) {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      presentationStyle: 'popover',
    });
  } catch {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  }
}

export function FloatingVideoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FloatingVideoState>({ videoId: null, title: '' });
  const [isMinimized, setIsMinimized] = useState(false);

  const openVideo = useCallback((videoId: string, title = '') => {
    if (isNative()) {
      openNativeBrowser(videoId);
    } else {
      setState({ videoId, title });
      setIsMinimized(false);
    }
  }, []);

  const closeVideo = useCallback(() => {
    setState({ videoId: null, title: '' });
    setIsMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  return (
    <FloatingVideoContext.Provider value={{ videoId: state.videoId, title: state.title, isMinimized, openVideo, closeVideo, toggleMinimize }}>
      {children}
    </FloatingVideoContext.Provider>
  );
}

export function useFloatingVideo() {
  const ctx = useContext(FloatingVideoContext);
  if (!ctx) throw new Error('useFloatingVideo must be used within FloatingVideoProvider');
  return ctx;
}
