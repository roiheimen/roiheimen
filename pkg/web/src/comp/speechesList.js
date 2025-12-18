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
    }
    ${self} th {
      text-align: left;
      padding: 6px 10px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    ${self} td {
      padding: 10px;
    }
    ${self} tr {
      border-bottom: 1px solid #e5e5e5;
    }
    ${self} .status-started {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      font-size: 1.1rem;
    }
    ${self} .status-ended {
      color: #999;
      text-decoration: line-through;
    }
    ${self} .status-cancelled {
      color: #b45309;
      text-decoration: line-through;
      background: #fffbeb;
    }
    ${self} .simple .status-cancelled { display: none }
    ${self} .color .is-prev { background: #f5f5f5; }
    ${self} .color .is-current { background: #c6f6d5; }
    ${self} .color .is-next { background: #fef9c3; }
    ${self} button {
      background: #f5f5f5;
      color: #444;
      border: 1px solid #ccc;
      padding: 4px 10px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    ${self} button:hover {
      background: #eee;
    }
    ${self} .status-started button {
      background: rgba(255,255,255,0.2);
      color: white;
      border-color: rgba(255,255,255,0.4);
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
