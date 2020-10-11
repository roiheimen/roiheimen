import { define, html } from "/web_modules/heresy.js";

export default define("RoiPersonList", {
  style(self) {
    return `
    ${self} {
      display: flex;
      justify-content: center;
    }
    ${self} .started { font-size: 140%; }
    ${self} .ended { text-decoration: line-through; color: gray; }
    `;
  },
  render({ useSel }) {
    const { people } = useSel("people");
    if (!people) {
      return this.html`Ingen folk`;
    }
    people.sort((a, b) => a.num - b.num);
    this.html`
      <table>
      <tr><th>Nummer <th>Namn <th>Lag <th>Anna </tr>
      ${people.map(
        (person) =>
          html`
            <tr id=${"person-" + person.id}>
              <td>${person.num}</td>
              <td>${person.name}</td>
              <td>${person.org}</td>
              <td>${person.admin ? "Admin" : ""}</td>
            </tr>
          `
      )}
      </table>
      `;
  },
});
