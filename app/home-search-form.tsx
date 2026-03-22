"use client";

import { useMemo, useRef, useState } from "react";

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
};

export function HomeSearchForm({ query }: HomeSearchFormProps) {
  const [value, setValue] = useState(query);
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const SpeechRecognitionApi = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null),
    []
  );

  const supportsVoice = Boolean(SpeechRecognitionApi);

  function startListening() {
    if (!SpeechRecognitionApi) {
      setStatusText("Röstsökning stöds inte i den här webbläsaren.");
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "sv-SE";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setValue(transcript);
      setStatusText(transcript ? "Röst fångad. Du kan söka direkt." : "Lyssnar...");
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatusText("Det gick inte att läsa av rösten just nu.");
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setStatusText("Lyssnar...");
    setIsListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setStatusText("");
  }

  return (
    <form className="form-grid" method="get">
      <label>
        Fråga eller sökord
        <div className="search-input-row">
          <input
            type="search"
            name="q"
            placeholder="Till exempel: adaptrar, hålsåg, nätverkskabel"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            className={`voice-button${isListening ? " listening" : ""}`}
            onClick={isListening ? stopListening : startListening}
            disabled={!supportsVoice}
            aria-label={isListening ? "Stoppa röstsökning" : "Starta röstsökning"}
            title={
              supportsVoice
                ? isListening
                  ? "Stoppa röstsökning"
                  : "Starta röstsökning"
                : "Röstsökning stöds inte i den här webbläsaren"
            }
          >
            {isListening ? "Stoppa" : "Mikrofon"}
          </button>
        </div>
      </label>
      <div className="search-actions">
        <button type="submit">Sök</button>
        <span className="muted voice-status">
          {supportsVoice
            ? statusText || "Tryck på Mikrofon och säg vad du letar efter."
            : "Röstsökning stöds inte i den här webbläsaren."}
        </span>
      </div>
    </form>
  );
}
