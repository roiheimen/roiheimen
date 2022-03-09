import { define, html } from "/web_modules/heresy.js";

export default define("RoiSpeechesList", {
  oninit() {
    this.simple = this.getAttribute("simple") != null;
    this.color = this.getAttribute("color") != null;
  },
  style(self) {
    return `
    ${self} {
      display: flex;
      justify-content: center;
    }
    ${self} .status-started {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2);
      font-size: 140%;
    }
    ${self} .status-ended { text-decoration: line-through; color: #666; }
    ${self} .status-cancelled { text-decoration: line-through; color: #875; }
    ${self} .simple .status-cancelled { display: none }
    ${self} .color tr { color: var(--roi-theme-font-color)}
    ${self} .color .is-prev { background-color: #eee }
    ${self} .color .is-current { background-color: #cea }
    ${self} .color .is-next { background-color: #ffa }
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
              <td style="display: flex">${speech.type == "REPLIKK" ? "↳ " : ""}${speech.speaker.name}${rm(speech)}</td>
              <td>${speech.speaker.org}</td>
            </tr>
          `
      )}
      </table>
      `;
  },
});
