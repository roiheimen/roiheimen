import { define, html } from "/web_modules/heresy.js";

export default define("RoiSpeechesList", {
  oninit() {
    this.simple = this.getAttribute("simple") != null;
  },
  style(self) {
    return `
    ${self} {
      display: flex;
      justify-content: center;
    }
    ${self} .status-started { font-size: 140%; }
    ${self} .status-ended { text-decoration: line-through; color: #666; }
    ${self} .status-cancelled { text-decoration: line-through; color: #875; }
    ${self} .simple .status-cancelled { display: none }
    `;
  },
  render({ useSel }) {
    const { sakObj, speechState } = useSel("sakObj", "speechState");
    let speeches = sakObj?.speeches;
    if (!speeches?.length) {
      return this.html`Ingen på lista`;
    }
    if (this.simple) {
      speeches = speeches.filter(s => !s.endedAt || s.id == speechState.prev?.id);
    }
    this.html`
      <table class=${this.simple ? "simple" : ""}>
      <tr><th>Nummer <th>Namn </tr>
      ${speeches.map(
        speech =>
          html`
            <tr class=${`status-${speech.status} type-${speech.type}`} title=${`${speech.type} av ${speech.speaker.name}`}>
              <td>${speech.speaker.num}</td>
              <td>${speech.type == "REPLIKK" ? "↳ " : ""}${speech.speaker.name}</td>
            </tr>
          `
      )}
      </table>
      `;
  }
});
