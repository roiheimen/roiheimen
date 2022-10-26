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
    this.html`
      <div data-id=${id}>
        <h3><span class="prev">Førre avrøysting:</span> ${title}</h3>
        ${
          hideResults
            ? null
            : referendumPrev.counts?.map((c) =>
                !c.choice && !c.count
                  ? html`${[]}`
                  : html` <span class="choice">${c.choice || "<blank>"} (${c.count})</span> `
              )
        }
        ${referendumPrev.vote && !hideResults ? html` <p>Du valde «${referendumPrev.vote.vote}».</p> ` : null}
      </div>
      `;
  },
});
