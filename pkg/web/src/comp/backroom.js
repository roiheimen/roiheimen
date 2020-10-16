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
      height: 500px;
      max-height: 80vh;
    }
    `;
  },
  render({ useSel, usePrevious }) {
    const { testActive, peopleById, myself } = useSel("testActive", "peopleById", "myself");
    const person = peopleById[testActive?.requesterId];

    const room = person?.room;
    const prevRoom = usePrevious(room);
    if (!room) return this.html`Person ${person?.num} ${person?.name} has no room!`;
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
      this.store.doTestUpdateStatus(id, "stop");
    }
  },
  render({ useEffect, useSel, useStore }) {
    this.store = useStore();
    const { peopleById, testActive, testListenAll, testStatus, tests } = useSel(
      "peopleById",
      "testActive",
      "testListenAll",
      "testStatus",
      "tests"
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
      if (!peopleById[t.requesterId]?.room) return null;
      if (!t.startedAt && t.finishedAt) return "Avbrutt";
      if (!t.startedAt) return html`<button name="test_start">Test</button> <button name="test_end">Avbryt</button>`;
      if (!t.finishedAt) return html`<button name="test_end">Avslutt</button>`;
      if (t.finishedAt) return "Ferdig";
      return "?";
    };
    tests.sort((a, b) => {
      return a.createdAt - b.createdAt;
    });
    const ferdig = [];
    const starta = [];
    const ustarta = [];
    for (const t of tests) {
      if (t.finishedAt) ferdig.push(t);
      else if (t.startedAt) starta.push(t);
      else if (!t.startedAt) ustarta.push(t);
      else ustarta.push(t);
    }
    const row = (t) =>
      html`
        <tr class=${`status-${t.status}`} data-id=${t.id}>
          <td>${peopleById[t.requesterId]?.num}</td>
          <td>${peopleById[t.requesterId]?.name}</td>
          <td>${testButtons(t)}</td>
        </tr>
      `;
    this.html`
      ${testActive ? html`<WherebyEmbed />` : null}
      <table onclick=${this}>
      <tr><th>Nummer <th>Namn </tr>
      ${starta.map(row)}
      ${ustarta.map(row)}
      ${ferdig.map(row)}
      </table>
    `;
  },
});
