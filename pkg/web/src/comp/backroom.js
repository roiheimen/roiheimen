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
    if (e.target == this || e.target.name == "close") {
      this.store.doClientUi("");
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
    this.html`
      <table>
      <tr><th>Nummer <th>Namn </tr>
      ${tests.map(
        (t) =>
          html`
            <tr class=${`status-${t.status}`}>
              <td>${peopleById[t.requesterId].num}</td>
              <td>${peopleById[t.requesterId].name}</td>
              <td>${peopleById[t.requesterId].room}</td>
            </tr>
          `
      )}
      </table>
    `;
  },
});
