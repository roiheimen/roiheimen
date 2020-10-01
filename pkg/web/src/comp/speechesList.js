import { define, html } from "/web_modules/heresy.js";

export default define("RoiSpeechesList", {
  style(self) {
    return `
    ${self} .started { font-size: 140%; }
    ${self} .ended { text-decoration: line-through; color: gray; }
    `;
  },
  render({ useSel }) {
    const { sak } = useSel("sak");
    if (!sak?.speeches) {
      return this.html`Ingen på lista`;
    }
    this.html`
      <table>
      <tr><th>Nummer <th>Namn </tr>
      ${sak.speeches.map(
        speech =>
          html`
            <tr class=${speech.startedAt ? (speech.endedAt ? "ended" : "started") : ""}>
              <td>${speech.speaker.num}</td>
              <td>${speech.speaker.name}</td>
            </tr>
          `
      )}
      </table>
      `;
  }
});
