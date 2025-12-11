import React, { createContext, useContext, useState, useEffect } from 'react';
import { localStorageService, LocalQuestionSet } from '../services/localStorageService';
import { loadDefaultQuestionSets } from '../data/defaultQuestionSets';

interface TrialModeContextType {
  isTrialMode: boolean;
  trialQuestionSets: LocalQuestionSet[];
  loadTrialQuestionSets: () => Promise<void>;
  createTrialQuestionSet: (title: string, description: string, questions: any[]) => Promise<LocalQuestionSet>;
  deleteTrialQuestionSet: (id: string) => Promise<void>;
  getTrialQuestionSet: (id: string) => Promise<LocalQuestionSet | null>;
  clearTrialData: () => Promise<void>;
}

const TrialModeContext = createContext<TrialModeContextType | undefined>(undefined);

export function TrialModeProvider({ children }: { children: React.ReactNode }) {
  const [trialQuestionSets, setTrialQuestionSets] = useState<LocalQuestionSet[]>([]);

  const loadTrialQuestionSets = async () => {
    console.log('[TrialModeContext] loadTrialQuestionSets called');
    const sets = await localStorageService.getTrialQuestionSets();
    console.log('[TrialModeContext] Loaded', sets.length, 'question sets');
    setTrialQuestionSets(sets);
  };

  const createTrialQuestionSet = async (
    title: string,
    description: string,
    questions: any[]
  ): Promise<LocalQuestionSet> => {
    const newSet = await localStorageService.saveTrialQuestionSet({
      title,
      description,
      questions: questions.map((q, index) => ({
        id: `q_${index}`,
        question: q.question,
        answer: q.answer,
        difficulty: q.difficulty,
      })),
    });
    await loadTrialQuestionSets();
    return newSet;
  };

  const deleteTrialQuestionSet = async (id: string) => {
    await localStorageService.deleteTrialQuestionSet(id);
    await loadTrialQuestionSets();
  };

  const getTrialQuestionSet = async (id: string) => {
    return await localStorageService.getTrialQuestionSet(id);
  };

  const clearTrialData = async () => {
    await localStorageService.clearAllTrialData();
    await loadTrialQuestionSets();
  };

  useEffect(() => {
    const initialize = async () => {
      console.log('[TrialModeContext] Initializing...');
      try {
        // デフォルト問題セットを初期化
        console.log('[TrialModeContext] Loading default question sets...');
        await loadDefaultQuestionSets();
        console.log('[TrialModeContext] Default question sets loaded');

        // 問題セット一覧を読み込み
        console.log('[TrialModeContext] Loading trial question sets...');
        await loadTrialQuestionSets();
        console.log('[TrialModeContext] Trial question sets loaded');
      } catch (error) {
        console.error('[TrialModeContext] Initialization error:', error);
      }
    };

    initialize();
  }, []);

  return (
    <TrialModeContext.Provider
      value={{
        isTrialMode: true,
        trialQuestionSets,
        loadTrialQuestionSets,
        createTrialQuestionSet,
        deleteTrialQuestionSet,
        getTrialQuestionSet,
        clearTrialData,
      }}
    >
      {children}
    </TrialModeContext.Provider>
  );
}

export function useTrialMode() {
  const context = useContext(TrialModeContext);
  if (context === undefined) {
    throw new Error('useTrialMode must be used within a TrialModeProvider');
  }
  return context;
}
