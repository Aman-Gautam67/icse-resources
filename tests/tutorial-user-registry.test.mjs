import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('Tutorial User Registry: client-side storage module logic', async () => {
  // Test simulated browser localStorage environment
  const mockStorage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStorage.get(key) || null,
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
    }
  };

  const {
    TUTORIAL_STORAGE_KEY,
    hasUserCompletedTutorial,
    recordTutorialCompletion,
    resetTutorialStatus
  } = await import('../src/lib/user-registry.ts');

  assert.equal(TUTORIAL_STORAGE_KEY, 'icse_user_registry_tutorial_v1');

  // Initially empty -> false
  assert.equal(hasUserCompletedTutorial(), false, 'Should be false on first visit');

  // User completes tutorial
  recordTutorialCompletion('completed');
  assert.equal(hasUserCompletedTutorial(), true, 'Should be true after completion');
  const record = JSON.parse(mockStorage.get(TUTORIAL_STORAGE_KEY));
  assert.equal(record.hasSeenTutorial, true);
  assert.equal(record.method, 'completed');
  assert.equal(record.tutorialVersion, 1);

  // User resets tutorial
  resetTutorialStatus();
  assert.equal(hasUserCompletedTutorial(), false, 'Should be false after reset');

  // User skips tutorial
  recordTutorialCompletion('skipped');
  assert.equal(hasUserCompletedTutorial(), true, 'Should be true after skipping');
  const skippedRecord = JSON.parse(mockStorage.get(TUTORIAL_STORAGE_KEY));
  assert.equal(skippedRecord.method, 'skipped');

  // Clean up global mock
  delete globalThis.window;
});

test('Tutorial Modal: Component contains next, skip, and update highlights', () => {
  const tutorialCode = fs.readFileSync(path.join(root, 'src/components/islands/TutorialModal.tsx'), 'utf8');

  // Must have Next and Skip buttons
  assert.match(tutorialCode, /Skip/i, 'Tutorial modal must include Skip button');
  assert.match(tutorialCode, /Next/i, 'Tutorial modal must include Next button');
  assert.match(tutorialCode, /Get Started/i, 'Tutorial modal must include Get Started button on final slide');
  assert.match(tutorialCode, /recordTutorialCompletion\('completed'\)/, 'Must record completion');
  assert.match(tutorialCode, /recordTutorialCompletion\('skipped'\)/, 'Must record skip');

  // Highlights updates requested by user
  assert.match(tutorialCode, /6,500\+/i, 'Must highlight 6,500+ files');
  assert.match(tutorialCode, /Ctrl \+ K|Spotlight Search/i, 'Must highlight search');
  assert.match(tutorialCode, /Organized Navigation|closed by default/i, 'Must highlight collapsed folders');
});

test('AppModals & InfoModal: Tutorial modal wiring and replay support', () => {
  const appModalsCode = fs.readFileSync(path.join(root, 'src/components/islands/AppModals.tsx'), 'utf8');
  assert.match(appModalsCode, /hasUserCompletedTutorial\(\)/, 'AppModals must check user registry');
  assert.match(appModalsCode, /case "tutorial":/, 'AppModals must handle "tutorial" modal event');
  assert.match(appModalsCode, /open-tutorial/, 'AppModals must handle "open-tutorial" event');
  assert.match(appModalsCode, /<TutorialModal\s+open=\{tutorialOpen\}/, 'AppModals must render TutorialModal');

  const infoModalCode = fs.readFileSync(path.join(root, 'src/components/islands/InfoModal.tsx'), 'utf8');
  assert.match(infoModalCode, /Replay Feature Tour & Updates Tutorial/i, 'InfoModal must provide replay button');
  assert.match(infoModalCode, /modal:\s*['"]tutorial['"]/, 'InfoModal replay button must trigger tutorial modal');
});
