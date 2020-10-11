import "https://whereby.dev/embed/whereby-embed.js";

import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";

const WherebyEmbed = {
  style(self) {
    return `
    ${self} {
      display: block;
      height: 100%;
    }
    ${self} whereby-embed {
      display: block;
      height: 100%;
      min-height: 400px;
    }
    `;
  },
  render({ useSel, usePrevious }) {
    const { testActive, peopleById, myself } = useSel("testActive", "peopleById", "myself");
    const person = peopleById[testActive.requesterId]
    const room = person.room;
    const prevRoom = usePrevious(room);
    if (!room) return this.html`Person ${person.num} ${person.name} has no room!`;
    if (room == prevRoom) return;
    this.html`
      <whereby-embed
        displayName=${myself?.name}
        room=${room} />
    `;
  },
};

define("RoiBackroom", {
  includes: { WherebyEmbed },
  style(self) {
    return `
    ${self} {
      display: flex;
      flex-direction: column;
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
    const { peopleById, testActive, testListenAll, testStatus, tests } = useSel(
      "peopleById",
      "testActive",
      "testListenAll",
      "testStatus",
      "tests",
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
      ${testActive ? html`<WherebyEmbed />` : null}
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
