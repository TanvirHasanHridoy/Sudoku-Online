/**
 * Procedural Dynamic Lo-Fi & Focus Audio Engine
 * 100% Web Audio API synthesis - zero external audio assets, zero streaming, fully offline.
 */

// Preset definitions
export const LOFI_PRESETS = {
  'rainy-cafe': {
    id: 'rainy-cafe',
    name: 'Rainy Cafe Lo-Fi',
    emoji: '☕',
    description: 'Warm jazz chords, gentle rain, and nostalgic vinyl crackle.',
    bpm: 68,
    chords: [
      // Fmaj7
      [174.61, 220.00, 261.63, 329.63],
      // Em7
      [164.81, 196.00, 246.94, 293.66],
      // Dm9
      [146.83, 174.61, 220.00, 261.63, 329.63],
      // Cmaj7
      [130.81, 164.81, 196.00, 246.94, 329.63]
    ],
    roots: [87.31, 82.41, 73.42, 65.41], // Bass roots (octave below)
    arpeggioPool: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50],
    chordFilterFreq: 950,
    noiseMode: 'rain',
  },
  'midnight-focus': {
    id: 'midnight-focus',
    name: 'Midnight Deep Focus',
    emoji: '🌌',
    description: 'Analog detuned drone pads, subterranean bass, and 14Hz beta tone.',
    bpm: 60,
    chords: [
      // Dsus2
      [146.83, 220.00, 329.63, 440.00],
      // Gsus2
      [196.00, 293.66, 440.00, 587.33],
      // Bm7
      [123.47, 185.00, 293.66, 440.00],
      // Asus4
      [110.00, 164.81, 293.66, 440.00]
    ],
    roots: [73.42, 98.00, 61.74, 55.00],
    arpeggioPool: [440.00, 493.88, 587.33, 659.25, 880.00],
    chordFilterFreq: 750,
    noiseMode: 'drone',
  },
  'tape-synth': {
    id: 'tape-synth',
    name: 'Tape Synth Warmth',
    emoji: '📼',
    description: '80s chillwave synth pads with wow/flutter pitch modulation.',
    bpm: 72,
    chords: [
      // Cmaj9
      [130.81, 196.00, 246.94, 293.66, 329.63],
      // Am9
      [110.00, 164.81, 196.00, 246.94, 261.63],
      // Fmaj7
      [174.61, 220.00, 261.63, 329.63],
      // G6
      [196.00, 246.94, 293.66, 329.63]
    ],
    roots: [65.41, 55.00, 87.31, 98.00],
    arpeggioPool: [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51],
    chordFilterFreq: 1150,
    noiseMode: 'tape',
  }
};

class FocusAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.atmosphereGain = null;
    this.musicGain = null;

    // State
    this.isEnabled = false;
    this.isPlayingMusic = false;
    this.volume = 0.5;
    this.currentPresetId = 'rainy-cafe';
    this.currentStage = 1; // 1: 0-30%, 2: 30-70%, 3: 70-100%
    this.currentProgress = 0;

    // Scheduler state
    this.schedulerTimer = null;
    this.vinylTimer = null;
    this.nextBeatTime = 0;
    this.currentBeat = 0;
    this.currentChordIndex = 0;

    // Atmosphere nodes
    this.noiseSource = null;
    this.noiseFilter = null;
    this.binauralOsc1 = null;
    this.binauralOsc2 = null;

    // Wow/Flutter LFO
    this.flutterLFO = null;
    this.flutterGain = null;

    // Active scheduled voices for cleanup
    this.activeVoices = [];

    // Load persisted settings
    this.loadSettings();
  }

  loadSettings() {
    try {
      const savedEnabled = localStorage.getItem('sudoku_lofi_enabled');
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
      const savedVol = localStorage.getItem('sudoku_lofi_volume');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
      const savedPreset = localStorage.getItem('sudoku_lofi_preset');
      if (savedPreset && LOFI_PRESETS[savedPreset]) {
        this.currentPresetId = savedPreset;
      }
    } catch {
      // Ignore localStorage read errors
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('sudoku_lofi_enabled', String(this.isEnabled));
      localStorage.setItem('sudoku_lofi_volume', String(this.volume));
      localStorage.setItem('sudoku_lofi_preset', this.currentPresetId);
    } catch {
      // Ignore localStorage write errors
    }
  }

  initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.ctx = new AudioContextClass();

    // Master Limiter to protect player's hearing and prevent any clipping
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-4, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(10, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);
    this.limiter.connect(this.ctx.destination);

    // Master volume gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.limiter);

    // Atmosphere sub-gain (rain, vinyl, tape hiss, drone)
    this.atmosphereGain = this.ctx.createGain();
    this.atmosphereGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.atmosphereGain.connect(this.masterGain);

    // Musical elements sub-gain (chords, bass, drums, arps)
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    // Wow/Flutter LFO (tape pitch modulation)
    this.flutterLFO = this.ctx.createOscillator();
    this.flutterLFO.frequency.setValueAtTime(0.35, this.ctx.currentTime); // 0.35 Hz slow drift
    this.flutterGain = this.ctx.createGain();
    this.flutterGain.gain.setValueAtTime(1.8, this.ctx.currentTime); // ~1.8 Hz detune depth
    this.flutterLFO.connect(this.flutterGain);
    this.flutterLFO.start();

    return this.ctx;
  }

  // Generate pink/brown noise buffer for rain and atmospheric bed
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 4; // 4 seconds loop
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Paul Kellet's refined pink noise filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  startAtmosphere() {
    if (!this.ctx || this.noiseSource) return;

    const preset = LOFI_PRESETS[this.currentPresetId] || LOFI_PRESETS['rainy-cafe'];
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();

    if (preset.noiseMode === 'rain') {
      // Rain texture: Warm band-pass centered at 900Hz
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setValueAtTime(850, this.ctx.currentTime);
      this.noiseFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
      this.atmosphereGain.gain.setValueAtTime(0.28, this.ctx.currentTime);
      this.startVinylCrackle();
    } else if (preset.noiseMode === 'drone') {
      // Midnight Drone: Deep low-pass filter + 14Hz binaural tone
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.atmosphereGain.gain.setValueAtTime(0.32, this.ctx.currentTime);
      this.startBinauralBetaWave();
    } else {
      // Tape Synth: Analog tape hiss (highpass around 1200Hz + low shelf warmth)
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
      this.noiseFilter.Q.setValueAtTime(0.5, this.ctx.currentTime);
      this.atmosphereGain.gain.setValueAtTime(0.16, this.ctx.currentTime);
    }

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.atmosphereGain);
    this.noiseSource.start();
  }

  stopAtmosphere() {
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    if (this.noiseFilter) {
      try { this.noiseFilter.disconnect(); } catch {}
      this.noiseFilter = null;
    }
    this.stopVinylCrackle();
    this.stopBinauralBetaWave();
  }

  startVinylCrackle() {
    this.stopVinylCrackle();
    // Schedule random subtle vinyl clicks
    const scheduleNextClick = () => {
      if (!this.isPlayingMusic || this.currentPresetId !== 'rainy-cafe' || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      const clickFilter = this.ctx.createBiquadFilter();

      clickFilter.type = 'bandpass';
      clickFilter.frequency.setValueAtTime(2000 + Math.random() * 4000, now);
      clickFilter.Q.setValueAtTime(4, now);

      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(80 + Math.random() * 200, now);

      const amp = 0.015 + Math.random() * 0.025;
      clickGain.gain.setValueAtTime(amp, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004 + Math.random() * 0.006);

      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.atmosphereGain);

      clickOsc.start(now);
      clickOsc.stop(now + 0.015);

      const nextDelay = 80 + Math.random() * 320; // 80-400ms random intervals
      this.vinylTimer = setTimeout(scheduleNextClick, nextDelay);
    };

    this.vinylTimer = setTimeout(scheduleNextClick, 100);
  }

  stopVinylCrackle() {
    if (this.vinylTimer) {
      clearTimeout(this.vinylTimer);
      this.vinylTimer = null;
    }
  }

  startBinauralBetaWave() {
    this.stopBinauralBetaWave();
    if (!this.ctx) return;

    try {
      // 14Hz beta wave: 200Hz base tone with 214Hz offset
      const now = this.ctx.currentTime;
      this.binauralOsc1 = this.ctx.createOscillator();
      this.binauralOsc2 = this.ctx.createOscillator();

      const binGain = this.ctx.createGain();
      binGain.gain.setValueAtTime(0.02, now); // Gentle background presence

      this.binauralOsc1.type = 'sine';
      this.binauralOsc1.frequency.setValueAtTime(196, now);

      this.binauralOsc2.type = 'sine';
      this.binauralOsc2.frequency.setValueAtTime(210, now); // 14Hz difference

      this.binauralOsc1.connect(binGain);
      this.binauralOsc2.connect(binGain);
      binGain.connect(this.atmosphereGain);

      this.binauralOsc1.start();
      this.binauralOsc2.start();
    } catch {}
  }

  stopBinauralBetaWave() {
    if (this.binauralOsc1) {
      try { this.binauralOsc1.stop(); this.binauralOsc1.disconnect(); } catch {}
      this.binauralOsc1 = null;
    }
    if (this.binauralOsc2) {
      try { this.binauralOsc2.stop(); this.binauralOsc2.disconnect(); } catch {}
      this.binauralOsc2 = null;
    }
  }

  // Play a soft, warm multi-voice chord
  playChord(frequencies, startTime, duration, filterFreq) {
    if (!this.ctx) return;

    frequencies.forEach((freq, idx) => {
      // Dual oscillator per note for rich chorus/electric piano timbre
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Slightly warm triangle + sine waves
      osc1.type = 'triangle';
      osc2.type = 'sine';

      // Subtle detuning for analog chorus warmth
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 1.002, startTime);

      // Connect tape flutter LFO to subtle pitch modulation
      if (this.flutterGain) {
        this.flutterGain.connect(osc1.frequency);
        this.flutterGain.connect(osc2.frequency);
      }

      // Warm low-pass filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 900, startTime);
      filter.Q.setValueAtTime(1.2, startTime);

      // Envelope: gentle attack, warm sustain, gentle release
      const attack = 0.28 + (idx * 0.04); // Strummed chord feel
      const decay = duration * 0.75;
      const noteVolume = (0.16 / frequencies.length) * (1 - idx * 0.08);

      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.linearRampToValueAtTime(noteVolume, startTime + attack);
      noteGain.gain.exponentialRampToValueAtTime(noteVolume * 0.55, startTime + decay);
      noteGain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.musicGain);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);

      this.activeVoices.push(osc1, osc2);
    });
  }

  // Play a mellow lo-fi sub-bass note
  playBass(freq, startTime, duration) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.24, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
    this.activeVoices.push(osc);
  }

  // Lo-Fi Sub Kick: Pitch-swept sine drop with punch
  playKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.25);
    this.activeVoices.push(osc);
  }

  // Lo-Fi Brush Snare / Rimshot
  playSnare(time) {
    if (!this.ctx) return;
    // Filtered noise burst + subtle tone pop
    const bufferSize = this.ctx.sampleRate * 0.18;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.Q.setValueAtTime(1.5, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.18);
    this.activeVoices.push(noise);
  }

  // Swung Lo-Fi Hi-Hat
  playHiHat(time, accent = false) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    const vol = accent ? 0.08 : 0.04;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    source.start(time);
    source.stop(time + 0.05);
    this.activeVoices.push(source);
  }

  // Sparkling Pentatonic Bell / Vibraphone Note (Stage 3 Climax)
  playBell(freq, time) {
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 2.01, time); // Bell overtone

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.10, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.75);
    osc2.stop(time + 0.75);
    this.activeVoices.push(osc1, osc2);
  }

  // Musical Sequencer Loop (Lookahead scheduler)
  schedule() {
    if (!this.isPlayingMusic || !this.ctx) return;

    const preset = LOFI_PRESETS[this.currentPresetId] || LOFI_PRESETS['rainy-cafe'];
    const secondsPerBeat = 60.0 / preset.bpm;
    const lookahead = 0.12; // Schedule ahead by 120ms

    while (this.nextBeatTime < this.ctx.currentTime + lookahead) {
      const beatInBar = this.currentBeat % 4;
      const barIndex = Math.floor(this.currentBeat / 4);

      // 1. Chords trigger every 2 bars (8 beats)
      if (this.currentBeat % 8 === 0) {
        const chordIndex = (Math.floor(this.currentBeat / 8)) % preset.chords.length;
        this.currentChordIndex = chordIndex;
        const chordFrequencies = preset.chords[chordIndex];
        const chordDuration = secondsPerBeat * 7.8; // Almost 8 beats with slight breath
        this.playChord(chordFrequencies, this.nextBeatTime, chordDuration, preset.chordFilterFreq);
      }

      // 2. Stage 2+ : Rhythm & Bass (30% - 100% progress)
      if (this.currentStage >= 2) {
        // Bassline on beats 0 and 2
        if (beatInBar === 0 || beatInBar === 2) {
          const rootFreq = preset.roots[this.currentChordIndex % preset.roots.length];
          this.playBass(rootFreq, this.nextBeatTime, secondsPerBeat * 1.8);
        }

        // Drums (Kick & Snare)
        if (beatInBar === 0) {
          this.playKick(this.nextBeatTime);
        } else if (beatInBar === 2) {
          // Syncopated kick slightly before or on 2
          this.playKick(this.nextBeatTime);
        }

        if (beatInBar === 1 || beatInBar === 3) {
          this.playSnare(this.nextBeatTime);
        }

        // Closed Hi-hat with relaxed swung 8th notes
        this.playHiHat(this.nextBeatTime, beatInBar === 0 || beatInBar === 2);
        const swingOffset = secondsPerBeat * 0.58; // Swung eighth note
        this.playHiHat(this.nextBeatTime + swingOffset, false);
      }

      // 3. Stage 3 : High-register Vibraphone / Bell Arpeggios (70% - 100% progress)
      if (this.currentStage >= 3) {
        // Play gentle bell melody notes on selected beats
        if (Math.random() > 0.35) {
          const pool = preset.arpeggioPool;
          const noteFreq = pool[Math.floor(Math.random() * pool.length)];
          const bellTime = this.nextBeatTime + (Math.random() > 0.5 ? 0 : secondsPerBeat * 0.5);
          this.playBell(noteFreq, bellTime);
        }
      }

      // Advance beat
      this.nextBeatTime += secondsPerBeat;
      this.currentBeat++;
    }
  }

  startSequencer() {
    this.stopSequencer();
    const preset = LOFI_PRESETS[this.currentPresetId] || LOFI_PRESETS['rainy-cafe'];
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.currentBeat = 0;
    this.currentChordIndex = 0;

    this.schedulerTimer = setInterval(() => {
      this.schedule();
    }, 45); // Check every 45ms
  }

  stopSequencer() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    // Clean up active voice oscillators
    this.activeVoices.forEach(node => {
      try { node.stop(); node.disconnect(); } catch {}
    });
    this.activeVoices = [];
  }

  // --- Public Control Interface ---

  play() {
    if (!this.initContext()) return;
    if (this.isPlayingMusic) return;

    this.isPlayingMusic = true;
    this.updateStageFromProgress(this.currentProgress);

    // Fade master gain smoothly into view
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 1.2);

    this.startAtmosphere();
    this.startSequencer();
  }

  pause() {
    if (!this.isPlayingMusic || !this.ctx) return;

    // Smoothly fade out before pausing
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);

    setTimeout(() => {
      this.isPlayingMusic = false;
      this.stopSequencer();
      this.stopAtmosphere();
    }, 650);
  }

  stop() {
    this.pause();
  }

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    this.saveSettings();

    if (this.ctx && this.masterGain && this.isPlayingMusic) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.08);
    }
  }

  setPreset(presetId) {
    if (!LOFI_PRESETS[presetId] || this.currentPresetId === presetId) return;

    this.currentPresetId = presetId;
    this.saveSettings();

    if (this.isPlayingMusic) {
      // Cross-fade restart to seamless new preset
      this.stopAtmosphere();
      this.stopSequencer();
      this.startAtmosphere();
      this.startSequencer();
    }
  }

  updateProgress(progressPercent) {
    const val = Math.max(0, Math.min(100, Number(progressPercent) || 0));
    this.currentProgress = val;
    this.updateStageFromProgress(val);
  }

  updateStageFromProgress(progress) {
    let nextStage = 1;
    if (progress >= 70) {
      nextStage = 3;
    } else if (progress >= 30) {
      nextStage = 2;
    }

    if (this.currentStage !== nextStage) {
      this.currentStage = nextStage;
    }
  }

  // Harmonious victory chord sweep when the puzzle is solved
  triggerWin() {
    if (!this.isPlayingMusic || !this.ctx) return;

    const now = this.ctx.currentTime;
    // Major 9th celebration sweep (C - E - G - B - D - G)
    const winNotes = [261.63, 329.63, 392.00, 493.88, 587.33, 783.99, 1046.50];

    winNotes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = now + (i * 0.12);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 2.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 2.6);
    });

    // Fade out ambient music gracefully over 4.5 seconds
    this.masterGain.gain.setValueAtTime(this.volume, now + 1.2);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 4.5);

    setTimeout(() => {
      this.pause();
    }, 4600);
  }

  toggleEnabled() {
    this.isEnabled = !this.isEnabled;
    this.saveSettings();
    if (!this.isEnabled) {
      this.pause();
    }
    return this.isEnabled;
  }

  setEnabled(enabled) {
    this.isEnabled = Boolean(enabled);
    this.saveSettings();
    if (!this.isEnabled) {
      this.pause();
    }
  }

  getPreset() {
    return LOFI_PRESETS[this.currentPresetId] || LOFI_PRESETS['rainy-cafe'];
  }
}

// Export singleton instance
export const focusAudio = new FocusAudioEngine();
