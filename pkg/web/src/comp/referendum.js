import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendum", {
  oninit() {
    this.addEventListener("submit", this);
  },
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
  onsubmit(e) {
    e.preventDefault();
    const { target } = e;
    console.log("sub", target, target.dataset.id);
    const referendumId = +target.dataset.id;
    const choice = target.choice.value;
    this.store.doReferendumVote({ referendumId, choice });
  },
  onclick({ target }) {
    console.log("click", target.name);
    if (target.name == "end") {
      const id = +target.closest("tr").dataset.id;
      this.store.doReferendumEnd(id);
    }
  },
  render({ useSel, useStore }) {
    this.store = useStore();
    const { referendum, referendumVote } = useSel("referendum", "referendumVote");
    if (!referendum) {
      return this.html` `;
    }
    const { id, title, type, finishedAt } = referendum;
    const choices = referendum.choices
      .map((a) => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.value);
    const humanType = { OPEN: "open røysting", CLOSED: "lukka røysting" }[type] || type;
    const chooser = () => html`
      <ul style="list-style: none">
        ${choices.map(
          (c) =>
            html`
              <li>
                <label><input type="radio" name="choice" value=${c} /> ${c}</label>
              </li>
            `
        )}
      </ul>
      <p><input type="submit" name="vote" value="Røyst" /></p>
      <p><button name="blank" onclick=${this}>Røyst blank</button></p>
    `;
    const didVote = () => html` Du har røysta. `;
    this.html`
      <form data-id=${id}>
        <h3>${title} (${humanType})</h3>
        ${referendumVote ? didVote() : chooser()}
      </form>
      `;
  },
});
