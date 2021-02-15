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
  render({ useEffect, useSel, useStore, useMemo, useState }) {
    this.store = useStore();
    const { config, myselfCanVote, referendum } = useSel("config", "myselfCanVote", "referendum");
    const [choose, setChoose] = useState(!referendum?.vote);
    useEffect(() => setChoose(!referendum?.vote?.id), [referendum?.vote?.vote]);
    const choices = useMemo(
      () =>
        config?.stableChoices ? referendum?.choices : referendum?.choices
          .map((a) => ({ sort: Math.random(), value: a }))
          .sort((a, b) => a.sort - b.sort)
          .map((a) => a.value),
      [referendum?.id]
    );
    if (!referendum) return this.html`${null}`;
    const { id, title, type, finishedAt } = referendum;
    const vote = referendum.vote?.vote;
    const humanType = { OPEN: "open avrøysting", CLOSED: "lukka votering" }[type] || type;
    const chooser = () => html`
      <ul style="list-style: none">
        ${choices.map(
          (c) =>
            html`
              <li>
                <label><input type="radio" name="choice" value=${c} checked=${vote && vote == c} /> ${c}</label>
              </li>
            `
        )}
      </ul>
      <p>${myselfCanVote ? html`<input type="submit" name="vote" value="Send inn" />` : `Du har ikkje røysterett`}</p>
    `;
    const didVote = () =>
      html`<p>
        Du har røysta. ${vote ? `Du valde «${vote}».` : null}
        ${choose ? null : html`<button name="back" type="button" onclick=${() => setChoose(true)}>Endra</button>`}
      </p>`;
    this.html`
      <form data-id=${id}>
        <h3>${title} (${humanType})</h3>
        ${choose && referendum.vote ? chooser() : null}
        ${referendum.vote?.id ? didVote() : null}
      </form>
      `;
  },
});
