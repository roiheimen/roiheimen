import { define, html } from "/web_modules/heresy.js";

export default define("RoiReferendumList", {
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
  onclick({ target }) {
    if (target.name == "start") {
      const id = +target.closest("tr").dataset.id;
      this.store.doReferendumStart(id);
    }
    if (target.name == "end") {
      const id = +target.closest("tr").dataset.id;
      this.store.doReferendumEnd(id);
    }
  },
  render({ useSel, useStore, useState, useEffect }) {
    this.store = useStore();
    const { referendum, referendums } = useSel("referendum", "referendums");
    const [updateCount, setUpdateCount] = useState(0);
    const [showAll, setShowAll] = useState(false);
    useEffect(() => this.store.doReferendumCount(), []);
    useEffect(() => setUpdateCount(0), [referendum?.id]);
    useEffect(() => {
      if (!referendum) return;
      // first 10 sec: check every 400ms
      // next 30 sec: check every sec
      // after: check every 6 sec
      const ms = updateCount < 25 ? 400 : (updateCount < 55 ? 1000 : 6000);
      const timer = setTimeout(() => {
        setUpdateCount(c => c + 1);
        this.store.doReferendumCount()
      }, ms);
      return () => clearTimeout(timer);
    }, [referendum?.id, updateCount]);
    if (!referendums.length) {
      return this.html`${null}`;
    }
    const interesting = referendums.filter(r => !r.finishedAt);
    const toggle = () => {
      if (referendums.length == interesting.length) return null;
      return html`<button style="margin-left: auto" .onclick=${() => setShowAll((s) => !s)}>
        ${showAll ? "Skjul ferdige" : "Vis alle"}
      </button>`;
    };
    this.html`
      <table>
      <tr><th>Avrøysting <th>Type <th>Val ${toggle()}<th>Tal <th>Anna </tr>
      ${(showAll ? referendums : interesting).map(
        (r) =>
          html`
            <tr data-id=${r.id}>
              <td>${r.title}</td>
              <td>${{ OPEN: "Open", CLOSED: "Lukka" }[r.type] || r.type}</td>
              <td>
                ${r.counts?.map((c) =>
                  !c.choice && !c.count
                    ? html`${[]}`
                    : html` <span class="choice">${c.choice || "<blank>"} (${c.count})</span> `
                )}
              </td>
              <td>${r.counts?.reduce((o, v) => o + (v.count || 0), 0)}</td>
              <td>${r.startedAt ? (r.finishedAt ? "Ferdig" : html` <button name="end" onclick=${this}>Avslutt</button> `) : html`<button name="start" onclick=${this}>Start</button>`}</td>
            </tr>
          `
      )}
      </table>
      `;
  },
});
