import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendumList", {
  style(self) {
    return `
    ${self} {
      display: flex;
      justify-content: center;
    }
    ${self} .choice {
      display: inline-block;
      background-color: #ddd;
      padding: 2px 4px;
      margin: 2px;
      border-radius: 2px;
    }
    `;
  },
  render({ useSel }) {
    const { referendums } = useSel("referendums");
    if (!referendums.length) {
      return this.html` `;
    }
    this.html`
      <table>
      <tr><th>Votering <th>Type <th>Val <th>Anna </tr>
      ${referendums.map(
        r =>
          html`
            <tr id=${"referendum-" + r.id}>
              <td>${r.title}</td>
              <td>${r.type}</td>
              <td>${r.choices.map(c => html`<span class=choice>${c}</span>`)}</td>
              <td>${r.finishedAt ? "Ferdig" : ""}</td>
            </tr>
          `
      )}
      </table>
      `;
  }
});
