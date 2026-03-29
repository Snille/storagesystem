class LagersystemSearchCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("div");
  }

  static getStubConfig() {
    return {
      type: "custom:lagersystem-search-card",
      title: "Storage Search",
      language: "en",
      text_script: "script.lagersystem_sok",
      voice_script: "script.lagersystem_fraga"
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._query = "";
    this._loading = false;
    this._error = "";
    this._listening = false;
    this._recognition = null;
    this._speechSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  setConfig(config) {
    this._config = {
      title: "Storage Search",
      language: "en",
      text_script: "script.lagersystem_sok",
      voice_script: "script.lagersystem_fraga",
      answer_entity: "input_text.lagersystem_last_answer",
      label_entity: "input_text.lagersystem_last_label",
      location_entity: "input_text.lagersystem_last_location",
      thumbnail_entity: "input_text.lagersystem_last_thumbnail_url",
      original_entity: "input_text.lagersystem_last_original_url",
      summary_entity: "input_text.lagersystem_last_summary",
      match_count_entity: "input_number.lagersystem_last_match_count",
      source_entity: "input_text.lagersystem_last_source",
      use_voice_script_for_microphone: true,
      ...config
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const active = this.shadowRoot?.activeElement;
    if (active && active.id === "query") {
      return;
    }
    this._render();
  }

  getCardSize() {
    return 6;
  }

  _strings() {
    const sv = {
      title: "Lagersök",
      placeholder: "Sök efter något i verkstan",
      search: "Sök",
      microphone: "Mikrofon",
      stop: "Stoppa",
      answer: "Svar",
      location: "Plats",
      summary: "Sammanfattning",
      imageAlt: "Träffbild",
      noAnswer: "Inget svar ännu.",
      listening: "Lyssnar...",
      notSupported: "Taligenkänning stöds inte i den här webbläsaren.",
      failed: "Sökningen misslyckades.",
      openImage: "Öppna bild",
      source: "Källa",
      matches: "Träffar"
    };
    const en = {
      title: "Storage Search",
      placeholder: "Search for something",
      search: "Search",
      microphone: "Microphone",
      stop: "Stop",
      answer: "Answer",
      location: "Location",
      summary: "Summary",
      imageAlt: "Match image",
      noAnswer: "No answer yet.",
      listening: "Listening...",
      notSupported: "Speech recognition is not available in this browser.",
      failed: "Search failed.",
      openImage: "Open image",
      source: "Source",
      matches: "Matches"
    };
    return this._config?.language === "sv" ? sv : en;
  }

  _state(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : undefined;
  }

  _value(entityId) {
    return this._state(entityId)?.state ?? "";
  }

  _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async _runScript(scriptEntityId, query) {
    if (!this._hass || !scriptEntityId || !query.trim()) {
      return;
    }

    const [domain, service] = scriptEntityId.split(".");
    if (domain !== "script" || !service) {
      throw new Error(`Invalid script entity: ${scriptEntityId}`);
    }

    this._loading = true;
    this._error = "";
    this._render();

    try {
      await this._hass.callService(domain, service, { query: query.trim() });
    } catch (error) {
      this._error = error instanceof Error ? error.message : this._strings().failed;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  async _submitText() {
    await this._runScript(this._config.text_script, this._query);
  }

  async _submitVoice(query) {
    const scriptEntityId = this._config.use_voice_script_for_microphone
      ? this._config.voice_script
      : this._config.text_script;
    await this._runScript(scriptEntityId, query);
  }

  _toggleListening() {
    const strings = this._strings();
    if (!this._speechSupported) {
      this._error = strings.notSupported;
      this._render();
      return;
    }

    if (this._listening && this._recognition) {
      this._recognition.stop();
      return;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      this._error = strings.notSupported;
      this._render();
      return;
    }

    this._error = "";
    const recognition = new RecognitionCtor();
    recognition.lang = this._config.language === "sv" ? "sv-SE" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      this._listening = true;
      this._render();
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      this._query = transcript;
      this._render();
    };

    recognition.onerror = () => {
      this._listening = false;
      this._recognition = null;
      this._error = strings.failed;
      this._render();
    };

    recognition.onend = async () => {
      const transcript = this._query.trim();
      this._listening = false;
      this._recognition = null;
      this._render();
      if (transcript) {
        await this._submitVoice(transcript);
      }
    };

    this._recognition = recognition;
    recognition.start();
  }

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const previousQueryInput = this.shadowRoot.getElementById("query");
    const hadQueryFocus = previousQueryInput && this.shadowRoot.activeElement === previousQueryInput;
    const selectionStart = hadQueryFocus ? previousQueryInput.selectionStart ?? this._query.length : null;
    const selectionEnd = hadQueryFocus ? previousQueryInput.selectionEnd ?? this._query.length : null;

    const strings = this._strings();
    const answer = this._value(this._config.answer_entity);
    const label = this._value(this._config.label_entity);
    const location = this._value(this._config.location_entity);
    const summary = this._value(this._config.summary_entity);
    const thumbnailUrl = this._value(this._config.thumbnail_entity);
    const originalUrl = this._value(this._config.original_entity) || thumbnailUrl;
    const source = this._value(this._config.source_entity);
    const matchCount = this._value(this._config.match_count_entity);
    const disabledAttr = this._loading ? "disabled" : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 16px;
          background:
            radial-gradient(circle at top left, rgba(148, 214, 97, 0.18), transparent 34%),
            linear-gradient(145deg, rgba(28, 34, 28, 0.98), rgba(19, 25, 22, 0.98));
          color: var(--primary-text-color);
        }
        .title {
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .controls {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: center;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: inherit;
          padding: 12px 14px;
          font: inherit;
        }
        button {
          border: 0;
          border-radius: 14px;
          padding: 11px 14px;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
          color: #0d160f;
          background: #94d661;
        }
        button.secondary {
          background: rgba(255,255,255,0.08);
          color: inherit;
        }
        button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .status {
          margin-top: 10px;
          min-height: 1.2em;
          color: var(--secondary-text-color);
          font-size: 0.92rem;
        }
        .error {
          color: #ff9f9f;
        }
        .result {
          margin-top: 14px;
          display: grid;
          gap: 12px;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.08);
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
        .body {
          display: grid;
          grid-template-columns: ${thumbnailUrl ? "112px 1fr" : "1fr"};
          gap: 14px;
          align-items: start;
        }
        .image-wrap {
          display: grid;
          gap: 8px;
        }
        img {
          width: 112px;
          height: 112px;
          object-fit: cover;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        a.image-link {
          color: var(--primary-color);
          text-decoration: none;
          font-size: 0.9rem;
        }
        .answer {
          font-size: 1rem;
          line-height: 1.45;
          font-weight: 600;
        }
        .line {
          color: var(--secondary-text-color);
          line-height: 1.45;
        }
        .label {
          color: var(--primary-text-color);
          font-weight: 700;
        }
        @media (max-width: 480px) {
          .controls {
            grid-template-columns: 1fr;
          }
          .body {
            grid-template-columns: 1fr;
          }
          img {
            width: 100%;
            height: auto;
            aspect-ratio: 1 / 1;
          }
        }
      </style>
      <ha-card>
        <div class="title">${this._config.title || strings.title}</div>
        <div class="controls">
          <input
            id="query"
            type="text"
            placeholder="${strings.placeholder}"
            value="${this._escapeHtml(this._query)}"
          />
          <button id="search" ${disabledAttr}>${this._loading ? "..." : strings.search}</button>
          <button id="voice" class="secondary" ${disabledAttr}>
            ${this._listening ? strings.stop : strings.microphone}
          </button>
        </div>
        <div class="status ${this._error ? "error" : ""}">
          ${this._escapeHtml(this._error || (this._listening ? strings.listening : ""))}
        </div>
        <div class="result">
          <div class="meta">
            ${source ? `<span class="pill">${this._escapeHtml(strings.source)}: ${this._escapeHtml(source)}</span>` : ""}
            ${matchCount && matchCount !== "unknown" ? `<span class="pill">${this._escapeHtml(strings.matches)}: ${this._escapeHtml(matchCount)}</span>` : ""}
          </div>
          <div class="body">
            ${thumbnailUrl ? `
              <div class="image-wrap">
                <img src="${this._escapeHtml(thumbnailUrl)}" alt="${this._escapeHtml(strings.imageAlt)}">
                ${originalUrl ? `<a class="image-link" href="${this._escapeHtml(originalUrl)}" target="_blank" rel="noreferrer">${this._escapeHtml(strings.openImage)}</a>` : ""}
              </div>
            ` : ""}
            <div>
              <div class="answer">${this._escapeHtml(answer || strings.noAnswer)}</div>
              ${label ? `<div class="line"><span class="label">${this._escapeHtml(label)}</span></div>` : ""}
              ${location ? `<div class="line">${this._escapeHtml(strings.location)}: ${this._escapeHtml(location)}</div>` : ""}
              ${summary ? `<div class="line">${this._escapeHtml(strings.summary)}: ${this._escapeHtml(summary)}</div>` : ""}
            </div>
          </div>
        </div>
      </ha-card>
    `;

    const queryInput = this.shadowRoot.getElementById("query");
    const searchButton = this.shadowRoot.getElementById("search");
    const voiceButton = this.shadowRoot.getElementById("voice");

    queryInput?.addEventListener("input", (event) => {
      this._query = event.target.value;
    });

    queryInput?.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await this._submitText();
      }
    });

    searchButton?.addEventListener("click", async () => {
      await this._submitText();
    });

    voiceButton?.addEventListener("click", () => {
      this._toggleListening();
    });

    if (hadQueryFocus && queryInput) {
      queryInput.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        queryInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

customElements.define("lagersystem-search-card", LagersystemSearchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lagersystem-search-card",
  name: "Lagersystem Search Card",
  description: "Search the storage system with text or microphone and show answer, image, and location."
});
