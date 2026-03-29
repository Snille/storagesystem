"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type HomeSearchAnswerProps = {
  answer: string;
  locale: string;
  autoSpeak: boolean;
  ui: {
    title: string;
    readAloud: string;
    stopReading: string;
    speechUnsupported: string;
  };
};

function pickVoice(locale: string, voices: SpeechSynthesisVoice[]) {
  const normalized = locale.toLowerCase();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${normalized.split("-")[0]}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(normalized.split("-")[0])) ??
    null
  );
}

export function HomeSearchAnswer({ answer, locale, autoSpeak, ui }: HomeSearchAnswerProps) {
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasAutoSpokenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    setSupportsSpeech(true);

    const updateVoices = () => {
      setVoicesReady(window.speechSynthesis.getVoices().length > 0);
    };

    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    hasAutoSpokenRef.current = false;
  }, [answer, autoSpeak]);

  const canSpeak = supportsSpeech && voicesReady;

  const speak = useMemo(
    () => () => {
      if (!canSpeak || typeof window === "undefined" || !answer.trim()) {
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = locale;
      const voice = pickVoice(locale, window.speechSynthesis.getVoices());
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [answer, canSpeak, locale]
  );

  useEffect(() => {
    if (!autoSpeak || hasAutoSpokenRef.current || !canSpeak || !answer.trim()) {
      return;
    }

    hasAutoSpokenRef.current = true;
    speak();
  }, [answer, autoSpeak, canSpeak, speak]);

  function stopSpeaking() {
    if (typeof window === "undefined" || !supportsSpeech) {
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }

  return (
    <div className="panel-quiet home-search-answer">
      <div className="home-search-answer-header">
        <h3>{ui.title}</h3>
        {supportsSpeech ? (
          <button
            type="button"
            className="button secondary"
            onClick={isSpeaking ? stopSpeaking : speak}
            disabled={!canSpeak}
          >
            {isSpeaking ? ui.stopReading : ui.readAloud}
          </button>
        ) : null}
      </div>
      <p className="home-search-answer-text">{answer}</p>
      {!supportsSpeech ? <p className="muted">{ui.speechUnsupported}</p> : null}
    </div>
  );
}
