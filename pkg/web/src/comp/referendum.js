import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendum", {
  oninit() {
    this.addEventListener("submit", this);
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} form {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      padding: 16px;
    }
    ${self} h3 {
      margin: 0 0 12px;
      font-size: 1.1rem;
      font-weight: 600;
      color: #276749;
    }
    ${self} ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    ${self} li {
      margin: 0 0 6px;
    }
    ${self} label {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid #c6f6d5;
      cursor: pointer;
      font-size: 1rem;
    }
    ${self} label:hover {
      background: #f0fff4;
    }
    ${self} input[type="radio"] {
      accent-color: #38a169;
    }
    ${self} label:has(input:checked) {
      background: #c6f6d5;
      border-color: #68d391;
    }
    ${self} p {
      margin: 12px 0 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    ${self} input[type="submit"] {
      background: #38a169;
      color: white;
      border: none;
      padding: 8px 16px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
    }
    ${self} input[type="submit"]:hover {
      background: #2f855a;
    }
    ${self} button[name="back"] {
      background: #f7fafc;
      color: #4a5568;
      border: 1px solid #cbd5e0;
      padding: 6px 12px;
      font-size: 0.9rem;
      cursor: pointer;
    }
    ${self} button[name="back"]:hover {
      background: #edf2f7;
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
        config?.stableChoices
          ? referendum?.choices
          : referendum?.choices
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
      <p>${myselfCanVote ? html` <input type="submit" name="vote" value="Send inn" /> ` : `Du har ikkje røysterett`}</p>
    `;
    const didVote = () =>
      html`
        <p title=${`Du valde «${vote}»`}>
          Du har røysta.
          ${choose ? null : html` <button name="back" type="button" onclick=${() => setChoose(true)}>Endra</button> `}
        </p>
      `;
    this.html`
      <form data-id=${id}>
        <h3>${title} (${humanType})</h3>
        ${choose && referendum.vote ? chooser() : null}
        ${referendum.vote?.id ? didVote() : null}
      </form>
      `;
  },
});
