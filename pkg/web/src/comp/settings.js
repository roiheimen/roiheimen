import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";

define("RoiSettings", {
  style(self) {
    return `
    ${self} {
      display: flex;
      position: absolute;
      overflow-y: scroll;
      top: 0;
      bottom: 0;
      right: 0;
      left: 0;
      justify-content: center;
      align-items: center;
      background-color: rgba(234, 113, 7, 0.4);
    }
    ${self} .settings {
      background: white;
      display: flex;
      flex-direction: column;
      padding: 20px;
      position: relative;
      min-height: 400px;
      max-width: 500px;
      width: 70vw;
    }
    ${self} .info {
      background: #ffc;
      padding: 10px 20px;
      margin: 0 -20px;
    }
    ${self} h2 {
      margin-top: 0;
    }
    ${self} .close {
      background: transparent;
      border: 0;
      display: block;
      font-size: 0;
      position: absolute;
      right: 10px;
      top: 10px;
    }
    ${self} .close::before {
      content: "×";
      display: block;
      font-size: 40px;
      height: 20px;
      line-height: 0.5;
      width: 20px;
    }
    ${self} .buttons {
      margin-top: auto;
    }
    `;
  },
  onconnected() {
    this.addEventListener("click", this);
    window.addEventListener("keydown", this);
  },
  ondisconnected() {
    this.removeEventListener("click", this);
    window.removeEventListener("keydown", this);
  },
  onkeydown({ key }) {
    console.log("k", key);
    if (key == "Escape") this.store.doClientUi("");
  },
  onclick(e) {
    if (e.target == this || e.target.name == "close") {
      this.store.doClientUi("");
    }
  },
  render({ useSel, useStore }) {
    this.store = useStore();
    const { testStatus } = useSel("testStatus");
    const testHtml = {
      active: html`
        <div class="info">Du er i eit test-møte.</div>
      `,
      waiting: html`
        <div class="info">
          Du har spurt om test, du blir teken inn når det er din tur. Du kan
          lukka dette vindauga.
        </div>
      `,
      requesting: html`
        <div>Spør om test.</div>
      `,
      listening: html`
        <button tabindex="0" .onclick=${() => this.store.doTestReq()}>
          Be om prat med bakrommet
        </button>
      `,
      "": ""
    }[testStatus];
    this.html`
      <div class=settings>
        <button name=close class=close>Lukk</button>
        <div>
          <h2>Prat med bakrommet</h2>
          <p>Det er lurt å gjera dette før du held eit innlegg, so du kan testa lyd og bilete.</p>
          ${testHtml}
        </div>
        <div class=buttons>
          <button name=close>Lukk</button>
          <button
            class=logout
            .onclick=${() => this.store.doMyselfLogout()}
            >Logg ut</button>
          </div>
      </div>
    `;
  }
});
