import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendumResult", {
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
    ${self} .prev {
      color: #888;
    }
    `;
  },
  render({ useSel, useStore, useMemo }) {
    this.store = useStore();
    const { config, referendumPrev } = useSel("config", "referendumPrev");
    if (!referendumPrev) {
      return this.html`${null}`;
    }
    const { id, type, title } = referendumPrev;
    const hideResults = type === "CLOSED" && config.hideClosedReferendumResults;
    const counts = referendumPrev.counts.slice() || [];
    counts.sort((a, b) => b.count - a.count);
    const winner = counts && counts[0]?.count > counts[1].count ? counts[0] : null;
    this.html`
      <div data-id=${id} title="${referendumPrev.vote && !hideResults ? `Du valde «${referendumPrev.vote.vote}».` : ""}">
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
