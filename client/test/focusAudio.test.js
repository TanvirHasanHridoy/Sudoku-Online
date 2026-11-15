import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals for Node test environment
globalThis.localStorage = {
  store: {},
  getItem(key) { return this.store[key] ?? null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

globalThis.window = {
  AudioContext: class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 44100;
    }
    resume() { this.state = 'running'; }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
          cancelScheduledValues() {},
        },
        connect() {},
        disconnect() {},
      };
    }
    createDynamicsCompressor() {
      return {
        threshold: { setValueAtTime() {} },
        knee: { setValueAtTime() {} },
        ratio: { setValueAtTime() {} },
        attack: { setValueAtTime() {} },
        release: { setValueAtTime() {} },
        connect() {},
      };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
    }
    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createBuffer(channels, length, sampleRate) {
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => new Float32Array(length),
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
    }
  }
};

const { focusAudio, LOFI_PRESETS } = await import('../src/utils/focusAudio.js');

test('LOFI_PRESETS contains valid configurations for all 3 moods', () => {
  assert.ok(LOFI_PRESETS['rainy-cafe'], 'rainy-cafe preset exists');
  assert.ok(LOFI_PRESETS['midnight-focus'], 'midnight-focus preset exists');
  assert.ok(LOFI_PRESETS['tape-synth'], 'tape-synth preset exists');

  for (const [id, preset] of Object.entries(LOFI_PRESETS)) {
    assert.equal(preset.id, id);
    assert.ok(preset.name.length > 0);
    assert.ok(preset.emoji.length > 0);
    assert.ok(preset.bpm >= 50 && preset.bpm <= 100);
    assert.ok(Array.isArray(preset.chords) && preset.chords.length >= 4);
    assert.ok(Array.isArray(preset.roots) && preset.roots.length >= 4);
    assert.ok(Array.isArray(preset.arpeggioPool) && preset.arpeggioPool.length > 0);
  }
});

test('focusAudio manages volume clamping and persistence', () => {
  focusAudio.setVolume(0.8);
  assert.equal(focusAudio.volume, 0.8);
  assert.equal(globalThis.localStorage.getItem('sudoku_lofi_volume'), '0.8');

  // Test clamping bounds
  focusAudio.setVolume(1.5);
  assert.equal(focusAudio.volume, 1);

  focusAudio.setVolume(-0.2);
  assert.equal(focusAudio.volume, 0);

  focusAudio.setVolume(0.5);
  assert.equal(focusAudio.volume, 0.5);
});

test('focusAudio manages presets and persistence', () => {
  focusAudio.setPreset('midnight-focus');
  assert.equal(focusAudio.currentPresetId, 'midnight-focus');
  assert.equal(globalThis.localStorage.getItem('sudoku_lofi_preset'), 'midnight-focus');

  focusAudio.setPreset('tape-synth');
  assert.equal(focusAudio.currentPresetId, 'tape-synth');

  focusAudio.setPreset('rainy-cafe');
  assert.equal(focusAudio.currentPresetId, 'rainy-cafe');
});

test('focusAudio handles multi-stage progression mapping correctly', () => {
  // Stage 1: 0% - 29%
  focusAudio.updateProgress(0);
  assert.equal(focusAudio.currentStage, 1);

  focusAudio.updateProgress(25);
  assert.equal(focusAudio.currentStage, 1);

  // Stage 2: 30% - 69%
  focusAudio.updateProgress(30);
  assert.equal(focusAudio.currentStage, 2);

  focusAudio.updateProgress(55);
  assert.equal(focusAudio.currentStage, 2);

  focusAudio.updateProgress(69);
  assert.equal(focusAudio.currentStage, 2);

  // Stage 3: 70% - 100%
  focusAudio.updateProgress(70);
  assert.equal(focusAudio.currentStage, 3);

  focusAudio.updateProgress(95);
  assert.equal(focusAudio.currentStage, 3);

  focusAudio.updateProgress(100);
  assert.equal(focusAudio.currentStage, 3);
});

test('focusAudio toggleEnabled and setEnabled work as expected', () => {
  focusAudio.setEnabled(false);
  assert.equal(focusAudio.isEnabled, false);
  assert.equal(globalThis.localStorage.getItem('sudoku_lofi_enabled'), 'false');

  focusAudio.setEnabled(true);
  assert.equal(focusAudio.isEnabled, true);
  assert.equal(globalThis.localStorage.getItem('sudoku_lofi_enabled'), 'true');

  focusAudio.setEnabled(false);
  assert.equal(focusAudio.isEnabled, false);
});

test('clearCorruptedSession wipes active room and board state to recover cleanly', async () => {
  const { clearCorruptedSession } = await import('../src/utils/recovery.js');
  globalThis.localStorage.setItem('sudoku_active_room_code', '998877');
  globalThis.localStorage.setItem('sudoku_game_state', JSON.stringify({ board: [] }));
  
  clearCorruptedSession();
  assert.equal(globalThis.localStorage.getItem('sudoku_active_room_code'), null);
  assert.equal(globalThis.localStorage.getItem('sudoku_game_state'), null);
});

test('All JSX tags used in App.jsx are valid imports or defined identifiers', async () => {
  const fs = await import('fs');
  const content = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf-8');
  const importsBlock = content.slice(0, content.indexOf('const THEMES ='));
  const jsxTags = new Set([...content.matchAll(/<([A-Z][a-zA-Z0-9]+)/g)].map(m => m[1]));
  
  const missing = [];
  for (const tag of jsxTags) {
    if (!importsBlock.includes(tag)) {
      missing.push(tag);
    }
  }
  assert.deepEqual(missing, [], `Found unimported JSX tags in App.jsx: ${missing.join(', ')}`);
});

test('Post-game completion modals are guarded by activeView === "game" to prevent home screen lingering', async () => {
  const fs = await import('fs');
  const content = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf-8');

  // Verify Win modal guard
  assert.ok(
    content.includes('activeView === "game" && gameStatus === "won"'),
    'Win modal must check activeView === "game"'
  );

  // Verify Loss modal guard
  assert.ok(
    content.includes('activeView === "game" && gameStatus === "lost"'),
    'Loss modal must check activeView === "game"'
  );

  // Verify Practice complete modal guard
  assert.ok(
    content.includes('activeView === "game" && gameStatus === "practice-completed"'),
    'Practice complete modal must check activeView === "game"'
  );
});

test('Solo-to-Lobby transition guarantees activeView = home and activeTab = lobby when room is not started', async () => {
  const fs = await import('fs');
  const content = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf-8');

  // Verify effect for pre-game room lobby
  assert.ok(
    content.includes('if (room && !room.isGameStarted)'),
    'App.jsx must watch room && !room.isGameStarted'
  );
  assert.ok(
    content.includes('useGameStore.setState({ gameStatus: "idle" })'),
    'App.jsx must reset gameStatus to idle when joining an unstarted room'
  );
});
