"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
};

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type HomeSearchFormProps = {
  query: string;
  speechRecognitionLocale: string;
  ui: {
    label: string;
    placeholder: string;
    voiceUnsupported: string;
    voiceCaptured: string;
    voiceListening: string;
    voiceError: string;
    voiceHint: string;
    startVoice: string;
    stopVoice: string;
    microphone: string;
    stop: string;
    submit: string;
  };
};

export function HomeSearchForm({ query, speechRecognitionLocale, ui }: HomeSearchFormProps) {
  const [value, setValue] = useState(query);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [speechRecognitionApi, setSpeechRecognitionApi] = useState<SpeechRecognitionConstructor | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const modeRef = useRef<HTMLInputElement | null>(null);
  const capturedTranscriptRef = useRef("");

  useEffect(() => {
    const api = window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
    setSpeechRecognitionApi(() => api);
  }, []);

  const supportsVoice = Boolean(speechRecognitionApi);

  function startListening() {
    if (!speechRecognitionApi) {
      setStatusText(ui.voiceUnsupported);
      return;
    }

    capturedTranscriptRef.current = "";
    const recognition = new speechRecognitionApi();
    recognition.lang = speechRecognitionLocale;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setValue(transcript);
      capturedTranscriptRef.current = transcript;
      setStatusText(transcript ? ui.voiceCaptured : ui.voiceListening);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatusText(ui.voiceError);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const transcript = capturedTranscriptRef.current.trim();
      if (transcript) {
        if (modeRef.current) {
          modeRef.current.value = "voice";
        }
        formRef.current?.requestSubmit();
      }
    };

    recognitionRef.current = recognition;
    setStatusText(ui.voiceListening);
    setIsListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setStatusText("");
    capturedTranscriptRef.current = "";
  }

  return (
    <form className="form-grid" method="get" ref={formRef}>
      <input ref={modeRef} type="hidden" name="mode" defaultValue="" />
      <label>
        {ui.label}
        <div className="search-input-row">
          <input
            type="search"
            name="q"
            placeholder={ui.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            className={`voice-button${isListening ? " listening" : ""}`}
            onClick={isListening ? stopListening : startListening}
            disabled={!supportsVoice}
            aria-label={isListening ? ui.stopVoice : ui.startVoice}
            title={
              supportsVoice
                ? isListening
                  ? ui.stopVoice
                  : ui.startVoice
                : ui.voiceUnsupported
            }
          >
            {isListening ? ui.stop : ui.microphone}
          </button>
        </div>
      </label>
      <div className="search-actions">
        <button
          type="submit"
          onClick={() => {
            if (modeRef.current) {
              modeRef.current.value = "";
            }
          }}
        >
          {ui.submit}
        </button>
        <span className="muted voice-status">
          {supportsVoice
            ? statusText || ui.voiceHint
            : ui.voiceUnsupported}
        </span>
      </div>
    </form>
  );
}
