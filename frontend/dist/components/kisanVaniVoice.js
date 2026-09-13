export const KisanVaniVoice = {
  currentLang: 'mr-IN',
  voices: [],
  isSpeaking: false,
  isListening: false,
  recognition: null,

  initVoices() {
    if ('speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
    }
  },

  getBestVoice(lang) {
    if (!this.voices || this.voices.length === 0) {
      this.voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    }
    const targetPrefix = lang.split('-')[0].toLowerCase();
    // 1. Exact match
    let voice = this.voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
    if (voice) return voice;
    // 2. Prefix match (e.g. 'mr', 'hi', 'en')
    voice = this.voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix));
    if (voice) return voice;
    // 3. Fallback to any Indian voice or default
    voice = this.voices.find(v => v.lang.includes('IN'));
    return voice || this.voices[0] || null;
  },

  speak(text, lang = this.currentLang) {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis not supported in this browser.');
      this.updateTranscript(`[Audio not supported in browser]: ${text}`);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly slower for clear agricultural comprehension
    utterance.pitch = 1.0;

    const matchedVoice = this.getBestVoice(lang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.updateVisualWave(true);
      const stopBtn = document.getElementById('btnStopKisanVoice');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.updateVisualWave(false);
      const stopBtn = document.getElementById('btnStopKisanVoice');
      if (stopBtn) stopBtn.style.display = 'none';
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      this.isSpeaking = false;
      this.updateVisualWave(false);
      const stopBtn = document.getElementById('btnStopKisanVoice');
      if (stopBtn) stopBtn.style.display = 'none';
    };

    window.speechSynthesis.speak(utterance);
    this.updateTranscript(text);
  },

  stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.updateVisualWave(false);
    const stopBtn = document.getElementById('btnStopKisanVoice');
    if (stopBtn) stopBtn.style.display = 'none';
  },

  startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your browser. You can click the quick question chips below.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.currentLang;
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        const micBtn = document.getElementById('btnKisanMic');
        const statusEl = document.getElementById('kisanVoiceStatus');
        if (micBtn) micBtn.classList.add('listening');
        if (statusEl) statusEl.textContent = this.currentLang === 'mr-IN' ? '🎙️ ऐकत आहे... (Speak now)' : this.currentLang === 'hi-IN' ? '🎙️ सुन रहा हूँ... (बोलिए)' : '🎙️ Listening... (Speak now)';
      };

      this.recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        this.updateTranscript(`You: "${transcript}"`);
        await this.handleUserQuery(transcript);
      };

      this.recognition.onerror = (err) => {
        console.warn('Recognition error:', err);
        this.stopListening();
      };

      this.recognition.onend = () => {
        this.stopListening();
      };

      this.recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      this.stopListening();
    }
  },

  stopListening() {
    this.isListening = false;
    const micBtn = document.getElementById('btnKisanMic');
    const statusEl = document.getElementById('kisanVoiceStatus');
    if (micBtn) micBtn.classList.remove('listening');
    if (statusEl) statusEl.textContent = 'Ready for Voice Commands';
    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
    }
  },

  async handleUserQuery(queryText) {
    const statusEl = document.getElementById('kisanVoiceStatus');
    if (statusEl) statusEl.textContent = 'Processing query...';

    try {
      const res = await fetch('/api/voice/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, lang: this.currentLang })
      });
      const data = await res.json();
      if (data.success && data.reply) {
        this.speak(data.reply, this.currentLang);
      }
    } catch (err) {
      console.error('Error handling voice query:', err);
      this.speak(
        this.currentLang === 'mr-IN' 
          ? 'माफ करा, संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.' 
          : 'Sorry, could not connect to agricultural advisory server.',
        this.currentLang
      );
    }
  },

  async playDailyBriefing() {
    const statusEl = document.getElementById('kisanVoiceStatus');
    if (statusEl) statusEl.textContent = 'Fetching live farmgate briefing...';

    try {
      const res = await fetch(`/api/voice/briefing?lang=${this.currentLang}`);
      const data = await res.json();

      if (data.success && data.briefing) {
        if (statusEl) statusEl.textContent = 'Speaking Daily Briefing...';
        this.speak(data.briefing.script, this.currentLang);
      }
    } catch (err) {
      console.error('Error fetching voice briefing:', err);
      this.speak(
        this.currentLang === 'mr-IN'
          ? 'नमस्कार. आज लासलगाव कांदा भाव २४ रुपये ५० पैसे आहे. तुमची पिकअप उद्या सकाळी साडे आठ वाजता आहे.'
          : 'Welcome. Today\'s direct Onion rate is 24.50 per kg. Your pickup is tomorrow at 8:30 AM.',
        this.currentLang
      );
    }
  },

  updateTranscript(text) {
    const logEl = document.getElementById('kisanVoiceTranscript');
    if (logEl) {
      logEl.innerHTML = `<div style="margin-top: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 4px;">${text}</div>` + logEl.innerHTML;
    }
  },

  updateVisualWave(speaking) {
    const waveEl = document.getElementById('kisanWaveVisualizer');
    if (waveEl) {
      waveEl.style.opacity = speaking ? '1' : '0.2';
      waveEl.querySelectorAll('.wave-bar').forEach(b => {
        b.style.animationPlayState = speaking ? 'running' : 'paused';
      });
    }
  },

  render() {
    this.initVoices();

    const existingWidget = document.getElementById('kisanVaniWidgetRoot');
    if (existingWidget) existingWidget.remove();

    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'kisanVaniWidgetRoot';
    widgetDiv.innerHTML = `
      <!-- Floating Trigger Pill Button (Always visible at bottom-right) -->
      <div id="kisanVaniTriggerBtn" class="kisan-vani-pill">
        <div class="kisan-pulse-ring"></div>
        <span style="font-size: 1.4rem;">🎙️</span>
        <div>
          <div style="font-size: 0.82rem; font-weight: 800; color: #fff; line-height: 1.1;">किसान वाणी AI</div>
          <div style="font-size: 0.68rem; color: #a7f3d0; font-weight: 600;">Voice Copilot & Briefing</div>
        </div>
        <span style="font-size: 1rem; color: #34d399; margin-left: 4px;">📢</span>
      </div>

      <!-- Expandable Copilot Deck -->
      <div id="kisanVaniDeck" class="kisan-vani-deck" style="display: none;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
              🌱
            </div>
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: #fff; margin: 0;">किसान वाणी (Kisan Vani)</h4>
              <span style="font-size: 0.7rem; color: #34d399; font-weight: 600;">Multilingual Voice Copilot</span>
            </div>
          </div>
          <button id="btnCloseKisanDeck" style="background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <!-- Language Selector -->
        <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 9999px; margin-bottom: 12px;">
          <button class="kisan-lang-btn active" data-lang="mr-IN" style="flex: 1; border: none; background: #10b981; color: #fff; border-radius: 9999px; padding: 4px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
            🇮🇳 मराठी
          </button>
          <button class="kisan-lang-btn" data-lang="hi-IN" style="flex: 1; border: none; background: transparent; color: #94a3b8; border-radius: 9999px; padding: 4px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
            🇮🇳 हिन्दी
          </button>
          <button class="kisan-lang-btn" data-lang="en-IN" style="flex: 1; border: none; background: transparent; color: #94a3b8; border-radius: 9999px; padding: 4px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
            🇬🇧 English
          </button>
        </div>

        <!-- Sound Wave Visualizer -->
        <div id="kisanWaveVisualizer" style="display: flex; justify-content: center; align-items: center; gap: 4px; height: 32px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-bottom: 12px; opacity: 0.2; transition: opacity 0.3s;">
          <div class="wave-bar" style="width: 3px; height: 16px; background: #10b981; border-radius: 2px; animation: soundWave 0.8s infinite ease-in-out alternate; animation-play-state: paused;"></div>
          <div class="wave-bar" style="width: 3px; height: 26px; background: #34d399; border-radius: 2px; animation: soundWave 0.6s infinite ease-in-out alternate; animation-play-state: paused;"></div>
          <div class="wave-bar" style="width: 3px; height: 20px; background: #38bdf8; border-radius: 2px; animation: soundWave 0.9s infinite ease-in-out alternate; animation-play-state: paused;"></div>
          <div class="wave-bar" style="width: 3px; height: 28px; background: #34d399; border-radius: 2px; animation: soundWave 0.7s infinite ease-in-out alternate; animation-play-state: paused;"></div>
          <div class="wave-bar" style="width: 3px; height: 14px; background: #10b981; border-radius: 2px; animation: soundWave 0.85s infinite ease-in-out alternate; animation-play-state: paused;"></div>
        </div>

        <!-- Status Indicator -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.75rem;">
          <span id="kisanVoiceStatus" style="color: #cbd5e1;">Ready for Voice Commands</span>
          <button id="btnStopKisanVoice" style="display: none; background: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.4); color: #fda4af; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; cursor: pointer;">
            ⏹️ Stop
          </button>
        </div>

        <!-- Action Controls -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="btnPlayDailyBriefing" class="btn btn-primary-farmer" style="flex: 1.4; padding: 10px; font-size: 0.8rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
            📢 Play Daily Briefing
          </button>
          <button id="btnKisanMic" class="btn btn-outline" style="flex: 1; border-color: #38bdf8; color: #38bdf8; padding: 10px; font-size: 0.8rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px;">
            🎤 Speak Query
          </button>
        </div>

        <!-- Quick Question Chips -->
        <div style="margin-bottom: 10px;">
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px;">Quick Voice Prompts:</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="voice-chip-btn" data-query="कांदा भाव">🧅 कांदा भाव</button>
            <button class="voice-chip-btn" data-query="मंडी भाव">📊 मंडी भाव</button>
            <button class="voice-chip-btn" data-query="पिकअप वेळ">🚚 पिकअप वेळ</button>
            <button class="voice-chip-btn" data-query="आजचे अपडेट">⚡ आजचे अपडेट</button>
          </div>
        </div>

        <!-- Transcript Logs -->
        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; max-height: 90px; overflow-y: auto; font-size: 0.74rem; color: #a7f3d0; line-height: 1.4;" id="kisanVoiceTranscript">
          <div>🎙️ किसान वाणी तयार आहे. "Play Daily Briefing" वर क्लिक करा किंवा माइक बटण दाबून विचारा.</div>
        </div>
      </div>

      <style>
        .kisan-vani-pill {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          background: rgba(13, 21, 39, 0.9);
          border: 2px solid #10b981;
          backdrop-filter: blur(16px);
          padding: 10px 18px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.35);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .kisan-vani-pill:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 15px 40px rgba(16, 185, 129, 0.5);
          border-color: #34d399;
        }
        .kisan-pulse-ring {
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          border: 2px solid #10b981;
          opacity: 0.5;
          animation: pulseRing 2s infinite ease-out;
          pointer-events: none;
        }
        @keyframes pulseRing {
          0% { transform: scale(0.98); opacity: 0.8; }
          100% { transform: scale(1.08); opacity: 0; }
        }
        .kisan-vani-deck {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10000;
          width: 360px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(16, 185, 129, 0.4);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
          animation: deckSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes deckSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes soundWave {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
        #btnKisanMic.listening {
          background: rgba(244, 63, 94, 0.2) !important;
          border-color: #f43f5e !important;
          color: #fda4af !important;
          animation: micPulse 1s infinite alternate;
        }
        @keyframes micPulse {
          0% { box-shadow: 0 0 5px #f43f5e; }
          100% { box-shadow: 0 0 20px #f43f5e; }
        }
        .voice-chip-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e2e8f0;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .voice-chip-btn:hover {
          background: rgba(16, 185, 129, 0.2);
          border-color: #10b981;
          color: #34d399;
        }
      </style>
    `;

    document.body.appendChild(widgetDiv);

    // Toggle deck view
    const triggerBtn = document.getElementById('kisanVaniTriggerBtn');
    const deck = document.getElementById('kisanVaniDeck');
    const closeBtn = document.getElementById('btnCloseKisanDeck');

    triggerBtn?.addEventListener('click', () => {
      deck.style.display = 'block';
      triggerBtn.style.display = 'none';
      this.initVoices();
    });

    closeBtn?.addEventListener('click', () => {
      deck.style.display = 'none';
      triggerBtn.style.display = 'flex';
      this.stopSpeech();
      this.stopListening();
    });

    // Language switcher
    document.querySelectorAll('.kisan-lang-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.kisan-lang-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = '#94a3b8';
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.style.background = '#10b981';
        e.currentTarget.style.color = '#fff';

        this.currentLang = e.currentTarget.getAttribute('data-lang');
        this.updateTranscript(`Language switched to: ${e.currentTarget.textContent.trim()}`);
      });
    });

    // Play Daily Briefing
    document.getElementById('btnPlayDailyBriefing')?.addEventListener('click', () => {
      this.playDailyBriefing();
    });

    // Speak Query Mic button
    document.getElementById('btnKisanMic')?.addEventListener('click', () => {
      this.startListening();
    });

    // Stop button
    document.getElementById('btnStopKisanVoice')?.addEventListener('click', () => {
      this.stopSpeech();
    });

    // Voice query chips
    document.querySelectorAll('.voice-chip-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const query = e.currentTarget.getAttribute('data-query');
        this.updateTranscript(`Query: "${query}"`);
        await this.handleUserQuery(query);
      });
    });
  }
};
