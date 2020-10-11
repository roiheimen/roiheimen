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
    if (target.name == "end") {
      const id = +target.closest("tr").dataset.id;
      this.store.doReferendumEnd(id);
    }
  },
  render({ useSel, useStore, useEffect }) {
    this.store = useStore();
    const { referendum, referendums } = useSel("referendum", "referendums");
    useEffect(() => {
      this.store.doReferendumCount();
    }, []);
    useEffect(() => {
      if (!referendum) return;
      const timer = setInterval(() => this.store.doReferendumCount(), 4000);
      return () => clearInterval(timer);
    }, [referendum]);
    if (!referendums.length) {
      return this.html`${null}`;
    }
    this.html`
      <table>
      <tr><th>Votering <th>Type <th>Val <th>Anna </tr>
      ${referendums.map(
        r =>
          html`
            <tr data-id=${r.id}>
              <td>${r.title}</td>
              <td>${{ OPEN: "Open", CLOSED: "Lukka" }[r.type] || r.type}</td>
              <td>
                ${r.counts?.map(c =>
                  !c.choice && !c.count
                    ? html`${[]}`
                    : html`
                        <span class="choice"
                          >${c.choice || "<blank>"} (${c.count})</span
                        >
                      `
                )}
              </td>
              <td>
                ${r.finishedAt
                  ? "Ferdig"
                  : html`
                      <button name="end" onclick=${this}>Avslutt</button>
                    `}
              </td>
            </tr>
          `
      )}
      </table>
      `;
  }
});
