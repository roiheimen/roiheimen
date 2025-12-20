import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendumResult", {
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} > div {
      padding: 10px 0;
      font-size: 0.9rem;
      color: var(--roi-text-secondary);
    }
    ${self} h3 {
      margin: 0 0 8px;
      font-size: 0.85rem;
      font-weight: 400;
    }
    ${self} .prev {
      color: var(--roi-text-tertiary);
    }
    ${self} .choice {
      display: inline-block;
      padding: 4px 8px;
      margin: 2px;
      font-size: 0.85rem;
      color: var(--roi-text-secondary);
    }
    ${self} .choice:first-of-type {
      font-weight: 600;
      color: var(--roi-text-primary);
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
