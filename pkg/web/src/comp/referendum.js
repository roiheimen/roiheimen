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
      background: var(--roi-bg-elevated);
      border: 1px solid var(--roi-border-medium);
      border-radius: 8px;
      padding: 16px;
    }
    ${self} h3 {
      margin: 0 0 12px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--roi-text-primary);
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
      background: var(--roi-bg-surface);
      border: 1px solid var(--roi-border-medium);
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      color: var(--roi-text-primary);
    }
    ${self} label:hover {
      border-color: var(--roi-primary);
    }
    ${self} input[type="radio"] {
      accent-color: var(--roi-primary);
    }
    ${self} label:has(input:checked) {
      background: var(--roi-bg-body);
      border-color: var(--roi-primary);
    }
    ${self} p {
      margin: 12px 0 0;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--roi-text-primary);
    }
    ${self} input[type="submit"] {
      background: var(--roi-primary);
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 4px;
    }
    ${self} input[type="submit"]:hover {
      background: var(--roi-primary-dark);
    }
    ${self} button[name="back"] {
      background: var(--roi-bg-surface);
      color: var(--roi-text-secondary);
      border: 1px solid var(--roi-border-medium);
      padding: 6px 12px;
      font-size: 0.9rem;
      cursor: pointer;
      border-radius: 4px;
    }
    ${self} button[name="back"]:hover {
      background: var(--roi-bg-body);
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
