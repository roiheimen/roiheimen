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
      background: var(--roi-bg-surface);
      border: 2px solid var(--roi-accent);
      border-radius: var(--roi-radius-lg);
      padding: 20px;
      box-shadow: 0 4px 16px rgba(255, 107, 53, 0.1);
    }
    ${self} h3 {
      margin: 0 0 16px;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--roi-primary);
      padding-bottom: 12px;
      border-bottom: 1px solid var(--roi-border-light);
    }
    ${self} ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    ${self} li {
      margin: 0 0 8px;
    }
    ${self} label {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      cursor: pointer;
      font-size: 1rem;
      color: var(--roi-text-primary);
      border-radius: var(--roi-radius-sm);
      transition: background var(--roi-transition-fast);
    }
    ${self} label:hover {
      background: var(--roi-bg-body);
    }
    ${self} input[type="radio"] {
      appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid var(--roi-gray-400);
      border-radius: 50%;
      background: white;
    }
    ${self} input[type="radio"]:checked {
      border-color: var(--roi-accent);
      background: var(--roi-accent);
    }
    ${self} label:has(input:checked) {
      background: var(--roi-bg-body);
      font-weight: 500;
    }
    ${self} p {
      margin: 16px 0 0;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--roi-text-primary);
    }
    ${self} input[type="submit"] {
      background: linear-gradient(135deg, var(--roi-accent) 0%, var(--roi-accent-dark) 100%);
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      border-radius: var(--roi-radius-md);
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
      transition: all var(--roi-transition-fast);
    }
    ${self} input[type="submit"]:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
    }
    ${self} button[name="back"] {
      background: var(--roi-bg-surface);
      color: var(--roi-text-secondary);
      border: 1px solid var(--roi-border-medium);
      padding: 8px 14px;
      font-size: 0.875rem;
      cursor: pointer;
      border-radius: var(--roi-radius-sm);
      transition: all var(--roi-transition-fast);
    }
    ${self} button[name="back"]:hover {
      background: var(--roi-bg-body);
      border-color: var(--roi-border-dark);
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
