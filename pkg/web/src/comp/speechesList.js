import { define, html } from "/web_modules/heresy.js";

export default define("RoiSpeechesList", {
  oninit() {
    this.readonly = this.getAttribute("readonly") != null;
    this.simple = this.getAttribute("simple") != null;
    this.color = this.getAttribute("color") != null;
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} table {
      width: 100%;
      border-radius: var(--roi-radius-md);
      overflow: hidden;
    }
    ${self} th {
      text-align: left;
      padding: 10px 12px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--roi-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--roi-bg-body);
    }
    ${self} td {
      padding: 12px;
      color: var(--roi-text-primary);
    }
    ${self} tr {
      border-bottom: 1px solid var(--roi-border-light);
      transition: background var(--roi-transition-fast);
    }
    ${self} tr:hover:not(.status-started):not(.status-ended):not(.status-cancelled) {
      background: var(--roi-bg-body);
    }
    ${self} .status-started {
      background: linear-gradient(135deg, var(--roi-accent) 0%, var(--roi-accent-dark) 100%);
      color: #ffffff;
    }
    ${self} .status-started td {
      background: transparent;
      color: #ffffff;
      font-size: 1.15rem;
      font-weight: 600;
      padding: 16px 12px;
    }
    ${self} .status-ended {
      color: var(--roi-text-tertiary);
      text-decoration: line-through;
      opacity: 0.7;
    }
    ${self} .status-cancelled {
      color: var(--roi-warning-text);
      text-decoration: line-through;
      background: var(--roi-warning-bg);
    }
    ${self} .simple .status-cancelled { display: none }
    ${self} .color .is-prev { background: var(--roi-bg-muted); }
    ${self} .color .is-current { background: var(--roi-bg-elevated); }
    ${self} .color .is-next { background: var(--roi-bg-elevated); }
    ${self} button {
      background: var(--roi-bg-surface);
      color: var(--roi-text-secondary);
      border: 1px solid var(--roi-border-medium);
      padding: 6px 12px;
      font-size: 0.8rem;
      cursor: pointer;
      border-radius: var(--roi-radius-sm);
      transition: all var(--roi-transition-fast);
    }
    ${self} button:hover {
      background: var(--roi-primary);
      color: var(--roi-text-inverse);
      border-color: var(--roi-primary);
    }
    ${self} .status-started button {
      background: rgba(255,255,255,0.2);
      color: white;
      border-color: rgba(255,255,255,0.4);
    }
    ${self} .status-started button:hover {
      background: rgba(255,255,255,0.35);
    }
    `;
  },
  render({ useSel, useState, useStore }) {
    const { sakObj, speechState, myself } = useSel("sakObj", "speechState", "myself");
    const [showAll, setShowAll] = useState(false);
    const store = useStore();
    const { speeches } = sakObj || {};
    if (!speeches?.length) return this.html`${null}`;
    const interesting = speeches.filter((s) => !s.endedAt || s.id == speechState.prev?.id);
    if (this.simple && interesting.length === 1 && interesting[0].endedAt) return this.html`${null}`;
    const speechClass = (speech) =>
      [
        `status-${speech.status}`,
        `type-${speech.type}`,
        speech.id == speechState.prev?.id && "is-prev",
        speech.id == speechState.current?.id && "is-current",
        speech.id == speechState.next?.id && "is-next",
      ]
        .filter(Boolean)
        .join(" ");
    const toggle = () => {
      if (this.simple || speeches.length == interesting.length) return null;
      return html`
        <button style="margin-left: auto" .onclick=${() => setShowAll((s) => !s)}>
          ${showAll ? "Skjul ferdige" : "Vis alle"}
        </button>
      `;
    };
    const rm = (speech) => {
      if (this.readonly) return null;
      if (speech.endedAt) return null;
      if (speech.speakerId == myself.id || (myself.admin && !this.simple))
        return html`
          <button style="margin-left: auto" .onclick=${() => store.doSpeechEnd(speech.id)}>
            ${speech.startedAt ? "Avslutt" : "Stryk"}
          </button>
        `;
    };
    this.html`
      <table class=${[this.simple && "simple", this.color && "color"].filter(Boolean).join(" ")}>
      <tr><th>Nummer <th style="display: flex">Namn ${toggle()} <th>Lag </tr>
      ${(showAll ? speeches : interesting).map(
        (speech) =>
          html`
            <tr class=${speechClass(speech)} title=${`${speech.type} av ${speech.speaker.name}`}>
              <td>${speech.speaker.num}</td>
              <td>
                <div style="display: flex">
                  ${speech.type == "REPLIKK" ? "↳ " : ""}${speech.speaker.name}${rm(speech)}
                </div>
              </td>
              <td>${speech.speaker.org}</td>
            </tr>
          `
      )}
      </table>
      `;
  },
});
