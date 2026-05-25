let audioCtx = null;

// Lazy initialization of the Web Audio API Context
// This satisfies browser security rules requiring user interaction before audio starts
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (common browser autoplay restriction state)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Dynamically synthesizes retro 8-bit chiptune sound effects using the Web Audio API.
 * Completely zero-dependency and optimized for desktop and mobile performance.
 */
export const playSound = {
  // 1. Correct Placement Chime: Satisfaction coin-like chime (C5 -> G5)
  correct: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Sequence of two notes
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(783.99, now + 0.06); // G5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
      gain.gain.setValueAtTime(0.18, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      
      osc.start(now);
      osc.stop(now + 0.23);
    } catch (e) {
      console.warn('[Audio Synth] Failed to play correct chime', e);
    }
  },

  // 2. Mistake / Strike: Low dissonant error buzz
  mistake: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Dual-oscillator detuning for thick gritty square wave sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'square';
      osc2.type = 'square';
      
      // Detune by 4Hz
      osc1.frequency.setValueAtTime(110.00, now); // A2
      osc2.frequency.setValueAtTime(114.00, now);
      
      // Pitch slide downwards
      osc1.frequency.exponentialRampToValueAtTime(65.41, now + 0.25); // C2
      osc2.frequency.exponentialRampToValueAtTime(67.41, now + 0.25);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.27);
      osc2.stop(now + 0.27);
    } catch (e) {
      console.warn('[Audio Synth] Failed to play mistake buzz', e);
    }
  },

  // 3. Game Start: Cyber arpeggio sweep (C4 -> E4 -> G4 -> C5)
  start: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const noteStart = now + idx * 0.07;
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.01);
        gain.gain.setValueAtTime(0.12, noteStart + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);
        
        osc.start(noteStart);
        osc.stop(noteStart + 0.21);
      });
    } catch (e) {
      console.warn('[Audio Synth] Failed to play start arpeggio', e);
    }
  },

  // 4. Victory: Triumphant major-chord fanfare (C5 -> E5 -> G5 -> C6 Rich chord + vibrato)
  win: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        
        // Add subtle pitch vibrato to the final sustained C6 note
        if (idx === 3) {
          const vibrato = ctx.createOscillator();
          const vibratoGain = ctx.createGain();
          
          vibrato.frequency.setValueAtTime(6, now + idx * 0.09); // 6Hz LFO
          vibratoGain.gain.setValueAtTime(8, now + idx * 0.09); // 8Hz modulation depth
          
          vibrato.connect(vibratoGain);
          vibratoGain.connect(osc.frequency);
          
          vibrato.start(now + idx * 0.09);
          vibrato.stop(now + 1.2);
        }
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const noteStart = now + idx * 0.09;
        const duration = idx === 3 ? 0.8 : 0.25;
        
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.15, noteStart + 0.02);
        gain.gain.setValueAtTime(0.15, noteStart + duration - 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        
        osc.start(noteStart);
        osc.stop(noteStart + duration + 0.01);
      });
    } catch (e) {
      console.warn('[Audio Synth] Failed to play victory fanfare', e);
    }
  },

  // 5. Defeat: Sad descending slide with crumbled volume tremolo
  lose: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const tremolo = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(293.66, now); // D4
      osc.frequency.linearRampToValueAtTime(73.42, now + 0.7); // D2 descending slide
      
      // Tremolo (fast volume modulation) for standard "retro-crumbling" chiptune effect
      tremolo.frequency.setValueAtTime(14, now); // 14Hz tremolo speed
      tremoloGain.gain.setValueAtTime(0.5, now); // tremolo depth
      
      tremolo.connect(tremoloGain);
      tremoloGain.connect(gain.gain);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      
      tremolo.start(now);
      osc.start(now);
      tremolo.stop(now + 0.72);
      osc.stop(now + 0.72);
    } catch (e) {
      console.warn('[Audio Synth] Failed to play defeat sweep', e);
    }
  },

  // 6. Hint: Sparkling magical glissando (sweeps 800Hz -> 2200Hz)
  hint: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750.00, now);
      osc.frequency.exponentialRampToValueAtTime(2400.00, now + 0.32); // Sparkle sweep
      
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(12, now); // high resonance for "magical" sound
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(3000, now + 0.32);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      console.warn('[Audio Synth] Failed to play hint chime', e);
    }
  },

  // 7. Opponent Correct: Soft, muffled, high-pitch pop (Triangle, C6, short + quiet)
  opponentCorrect: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.50, now); // C6 high blip
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Extremely quiet (0.035) so it doesn't disturb player
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      
      osc.start(now);
      osc.stop(now + 0.065);
    } catch (e) {
      console.warn('[Audio Synth] Failed to play opponent correct cue', e);
    }
  },

  // 8. Opponent Strike: Distant muffled alarm alert (detuned square wave, low volume)
  opponentStrike: (enabled = true) => {
    if (!enabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Muffled double blip warning chimes
      [0, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440.00, now + delay); // A4
        
        // Lowpass filter to make it sound "distant / muffled"
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now + delay);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        const noteStart = now + delay;
        // Keep it quiet (0.04) and short
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.04, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.12);
        
        osc.start(noteStart);
        osc.stop(noteStart + 0.13);
      });
    } catch (e) {
      console.warn('[Audio Synth] Failed to play opponent strike alarm', e);
    }
  }
};
