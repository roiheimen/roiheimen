import { define, html } from "/web_modules/heresy.js";

export default define("RoiPersonList", {
  oninit() {
    this.addEventListener("submit", this);
    this.editable = this.getAttribute("editable") != null;
  },
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
  onsubmit(e) {
    const voteDisallowNum = [];
    for (const input of e.target) {
      if (input.name == "disallowvote" && input.checked) {
        const num = +input.dataset.num;
        voteDisallowNum.push(num);
      }
    }
    this.store.doSakUpd({ config: { voteDisallowNum } });
    this.setEdit(false);
    e.preventDefault();
  },
  render({ useSel, useState, useStore }) {
    this.store = useStore();
    const { config, people } = useSel("config", "people");
    const [edit, setEdit] = useState(false);
    this.setEdit = setEdit;
    this.config = config;
    if (!people) {
      return this.html`Ingen folk`;
    }
    people.sort((a, b) => a.num - b.num);
    function personProps(p) {
      return [p.admin ? "Admin" : "", p.canVote ? "" : "Ingen røysterett"].filter(Boolean).join(", ");
    }
    this.html`
    <form>
      <table>
      <tr><th>Nummer <th>Namn <th>Lag <th>Anna ${
        this.editable ? html`<button type="button" onclick=${() => setEdit(!edit)}>Endra</button>` : null
      }</tr>
      ${people.map(
        (person) =>
          html`
            <tr id=${"person-" + person.id}>
              <td>${person.num}</td>
              <td>${person.name}</td>
              <td>${person.org}</td>
              <td>
                ${edit
                    ? html`<label><input
                      type="checkbox"
                      data-num=${person.num}
                      name="disallowvote"
                      checked=${!person.canVote}
                    /> Ingen røysterett</label>`
                  : personProps(person)}
              </td>
            </tr>
          `
      )}
      </table>
      ${edit ? html`<input type="submit" value="Oppdater" />` : null}
    </form>
      `;
  },
});
