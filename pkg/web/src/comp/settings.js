import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";

define("RoiSettings", {
  style(self) {
    return `
    ${self} {
      display: flex;
      position: fixed;
      overflow-y: scroll;
      top: 0;
      bottom: 0;
      right: 0;
      left: 0;
      justify-content: center;
      align-items: center;
      background-color: var(--roi-bg-overlay);
      z-index: 100;
    }
    ${self} .settings {
      background: var(--roi-bg-surface);
      display: flex;
      flex-direction: column;
      padding: 24px;
      position: relative;
      min-height: 200px;
      max-width: 500px;
      width: 70vw;
      border-radius: var(--roi-radius-xl);
      box-shadow: var(--roi-shadow-2xl);
    }
    ${self} .info {
      background: var(--roi-warning-bg);
      border: 1px solid var(--roi-warning-light);
      border-left: 4px solid var(--roi-warning);
      padding: 12px 16px;
      margin: 0 0 16px;
      border-radius: var(--roi-radius-md);
      color: var(--roi-warning-text);
      font-size: 0.95rem;
    }
    ${self} h2 {
      margin: 0 0 16px;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--roi-primary);
    }
    ${self} p {
      color: var(--roi-text-primary);
      line-height: 1.6;
      margin: 0 0 12px;
    }
    ${self} strong {
      color: var(--roi-primary);
    }
    ${self} label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--roi-text-primary);
    }
    ${self} input[type="checkbox"] {
      accent-color: var(--roi-accent);
      width: 16px;
      height: 16px;
    }
    ${self} .close {
      background: transparent;
      border: 0;
      display: block;
      font-size: 0;
      position: absolute;
      right: 16px;
      top: 16px;
      cursor: pointer;
      color: var(--roi-text-tertiary);
      transition: color var(--roi-transition-fast);
    }
    ${self} .close:hover {
      color: var(--roi-text-primary);
    }
    ${self} .close::before {
      content: "×";
      display: block;
      font-size: 32px;
      height: 24px;
      line-height: 0.75;
      width: 24px;
    }
    ${self} .buttons {
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid var(--roi-border-light);
      display: flex;
      gap: 10px;
    }
    ${self} .buttons button {
      padding: 10px 20px;
      border-radius: var(--roi-radius-md);
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--roi-transition-fast);
    }
    ${self} .buttons button[name="close"] {
      background: var(--roi-bg-body);
      border: 1px solid var(--roi-border-medium);
      color: var(--roi-text-secondary);
    }
    ${self} .buttons button[name="close"]:hover {
      background: var(--roi-bg-surface);
      border-color: var(--roi-border-dark);
    }
    ${self} .buttons .logout {
      background: var(--roi-error-bg);
      border: 1px solid var(--roi-error-light);
      color: var(--roi-error-text);
      margin-left: auto;
    }
    ${self} .buttons .logout:hover {
      background: var(--roi-error);
      color: #ffffff;
      border-color: var(--roi-error);
    }
    ${self} > div button:not(.close):not(.logout) {
      background: var(--roi-primary);
      color: #ffffff;
      border: none;
      padding: 10px 16px;
      border-radius: var(--roi-radius-md);
      font-size: 0.95rem;
      cursor: pointer;
      transition: all var(--roi-transition-fast);
    }
    ${self} > div button:not(.close):not(.logout):hover {
      background: var(--roi-primary-dark);
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
    const { config, clientGfxIframe, meeting, myself, myselfCanVote, testStatus } = useSel(
      "config",
      "clientGfxIframe",
      "meeting",
      "myself",
      "myselfCanVote",
      "testStatus"
    );
    const testHtml = {
      active: html` <div class="info">Du er i eit test-møte.</div> `,
      waiting: html`
        <div class="info">
          Du har spurt om test, du er no i ein kø. Du vert teken inn når det er din tur. Dette vil berre skje når dei
          bakrommet er tilstades. Du kan lukka dette vindauga.
        </div>
      `,
      requesting: html` <div>Spør om test.</div> `,
      listening: html`
        <button tabindex="0" .onclick=${() => this.store.doTestReq()}>Be om prat med bakrommet (t.d. for test)</button>
      `,
      "": "",
    }[testStatus];
    this.html`
      <div class=settings>
        <button name=close class=close>Lukk</button>
        <div>
          <h2>Informasjon</h2>
          <p>
          Møte: <strong>${meeting?.title}</strong> (${meeting?.id})<br>
          Namn: <strong>${myself?.name}</strong><br>
          Nummer: <strong>${myself?.num}</strong><br>
          Organisasjon: <strong>${myself?.org}</strong>
          </p>
          <p>${myselfCanVote ? "Du har løyve til å røysta." : "Du har ikkje løyve til å røysta."}</p>
          ${
            config.gfxIframeOnQueue !== false
              ? html`
                  <p>
                    <label
                      ><input
                        type="checkbox"
                        name="gfxIframe"
                        onchange=${() => store.doClientConfig({ userGfxIframeOnQueue: !clientGfxIframe })}
                        checked=${clientGfxIframe}
                      />
                      Vis direkte avrøystingsgrafikk (fungerer dårleg på nokre nettverk)</label
                    >
                  </p>
                `
              : null
          }
        </div>
        ${
          config.backroom
            ? html`
                <div>
                  <h2>Prat med bakrommet</h2>
                  <p>Det er lurt å gjera dette før du held eit innlegg, so du kan testa lyd og bilete.</p>
                  ${testHtml}
                </div>
              `
            : null
        }
        <div class=buttons>
          <button name=close>Lukk</button>
          <button
            class=logout
            .onclick=${() => this.store.doMyselfLogout()}
            >Logg ut</button>
          </div>
      </div>
    `;
  },
});
