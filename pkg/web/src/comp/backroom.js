import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";

define("RoiBackroom", {
  style(self) {
    return `
    ${self} {
      display: flex;
    }
    `;
  },
  onclick(e) {
    const id = e.target.closest("tr")?.dataset.id;
    if (e.target.name == "test_start") {
      this.store.doTestUpdateStatus(id, "start");
    }
    if (e.target.name == "test_end") {
      this.store.doTestUpdateStatus(id, "end");
    }
  },
  render({ useEffect, useSel, useStore }) {
    this.store = useStore();
    const { tests, testStatus, testListenAll, peopleById } = useSel(
      "tests",
      "testStatus",
      "testListenAll",
      "peopleById"
    );
    useEffect(() => {
      if (testStatus && testStatus !== "starting" && !testListenAll) {
        this.store.doTestSubscribe("all");
      }
    }, [testListenAll, testStatus]);
    if (!tests?.length) {
      return this.html`Ingen på lista`;
    }
    const testButtons = (t) => {
      if (!peopleById[t.requesterId].room) return null;
      if (!t.startedAt) return html`<button name="test_start">Test</button>`;
      if (!t.finishedAt) return html`<button name="test_end">Avslutt</button>`;
      return "Ferdig";
    };
    this.html`
      <table onclick=${this}>
      <tr><th>Nummer <th>Namn </tr>
      ${tests.map(
        (t) =>
          html`
            <tr class=${`status-${t.status}`} data-id=${t.id}>
              <td>${peopleById[t.requesterId].num}</td>
              <td>${peopleById[t.requesterId].name}</td>
              <td>${testButtons(t)}</td>
            </tr>
          `
      )}
      </table>
    `;
  },
});
