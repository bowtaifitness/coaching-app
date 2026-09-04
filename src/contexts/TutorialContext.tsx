import React, { createContext, useContext, useState, useCallback } from 'react';

interface TutorialContextValue {
  isTutorialOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const openTutorial = useCallback(() => setIsTutorialOpen(true), []);
  const closeTutorial = useCallback(() => setIsTutorialOpen(false), []);

  return (
    <TutorialContext.Provider value={{ isTutorialOpen, openTutorial, closeTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
};

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within a TutorialProvider');
  return ctx;
}
