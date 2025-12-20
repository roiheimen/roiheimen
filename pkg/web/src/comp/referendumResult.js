import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendumResult", {
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} > div {
      background: var(--roi-bg-elevated);
      border: 1px solid var(--roi-border-light);
      border-radius: 8px;
      padding: 14px 16px;
    }
    ${self} h3 {
      margin: 0 0 10px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--roi-text-primary);
    }
    ${self} .prev {
      color: var(--roi-text-secondary);
      font-weight: 400;
    }
    ${self} .choice {
      display: inline-block;
      background: var(--roi-bg-surface);
      border: 1px solid var(--roi-border-medium);
      border-radius: 4px;
      padding: 6px 10px;
      margin: 2px;
      font-size: 0.9rem;
      color: var(--roi-text-primary);
    }
    ${self} .choice:first-of-type {
      background: var(--roi-primary);
      border-color: var(--roi-primary);
      color: #ffffff;
      font-weight: 600;
    }
    `;
  },
  render({ useEffect, useRef, useSel, useStore, useMemo }) {
    this.store = useStore();
    const { config, referendumPrev } = useSel("config", "referendumPrev");
    const div = useRef();
    useEffect(() => {
      if (div.current) div.current.hidden = false;
      const t = setTimeout(() => {
        if (div.current) div.current.hidden = true;
      }, 25000);
      return () => clearTimeout(t);
    }, [div.current, referendumPrev?.id]);
    if (!referendumPrev) {
      return this.html`${null}`;
    }
    const { id, type, title } = referendumPrev;
    const hideResults = type === "CLOSED" && config.hideClosedReferendumResults;
    const counts = referendumPrev.counts.slice() || [];
    counts.sort((a, b) => b.count - a.count);
    const winner = counts && counts[0]?.count > counts[1]?.count ? counts[0] : null;
    this.html`
      <div ref=${div} data-id=${id} title=${referendumPrev.vote ? `Du valde «${referendumPrev.vote.vote}».` : ""}>
        <h3><span class="prev">Førre avrøysting:</span> ${title}</h3>
        ${
          hideResults
            ? winner
              ? html`<span class="choice">${winner.choice || "<blank>"}</span>`
              : html`&ndash;`
            : counts.map((c) =>
                !c.choice && !c.count
                  ? html`${[]}`
                  : html` <span class="choice">${c.choice || "<blank>"} (${c.count})</span> `
              )
        }
      </div>
      `;
  },
});
