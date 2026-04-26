import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const finalCallbackRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      setTranscript('');
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      const code = e?.error ?? 'unknown';
      const friendly =
        code === 'not-allowed'
          ? 'Microphone permission denied'
          : code === 'no-speech'
          ? "Didn't catch that — try again"
          : code === 'audio-capture'
          ? 'No microphone detected'
          : `Voice error: ${code}`;
      setError(friendly);
      setListening(false);
    };
    rec.onresult = (e) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const combined = (final + interim).trim();
      setTranscript(combined);
      if (final) {
        const cb = finalCallbackRef.current;
        if (cb) cb(final.trim());
      }
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, []);

  const start = useCallback(({ lang, onFinal } = {}) => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    rec.lang = lang || 'en-IN';
    finalCallbackRef.current = onFinal ?? null;
    try {
      rec.start();
    } catch {
      // Already started — ignore
    }
  }, [listening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {}
    setListening(false);
  }, []);

  return { start, stop, listening, transcript, error, supported };
}
