/**
 * Client-side user registry without login.
 * Tracks feature adoption, tutorial completion, and preferences in localStorage.
 */

export const TUTORIAL_STORAGE_KEY = 'icse_user_registry_tutorial_v1';

export interface UserRegistryRecord {
  hasSeenTutorial: boolean;
  tutorialVersion: number;
  completedAt: number;
  method: 'completed' | 'skipped';
}

/**
 * Check whether the current user has already seen and dismissed/completed the tutorial.
 */
export function hasUserCompletedTutorial(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as UserRegistryRecord;
    return Boolean(data && data.hasSeenTutorial);
  } catch {
    return false;
  }
}

/**
 * Record that the user has completed or skipped the tutorial.
 */
export function recordTutorialCompletion(method: 'completed' | 'skipped' = 'completed'): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const record: UserRegistryRecord = {
      hasSeenTutorial: true,
      tutorialVersion: 1,
      completedAt: Date.now(),
      method,
    };
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    console.warn('Could not save tutorial completion to localStorage:', err);
  }
}

/**
 * Reset tutorial completion status so the user can re-watch the tour.
 */
export function resetTutorialStatus(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}
