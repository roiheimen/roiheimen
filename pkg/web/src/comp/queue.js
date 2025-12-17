import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./referendum.js";
import "./referendumResult.js";
import "./settings.js";
import "./speechesList.js";
import "./video.js";

const RoiQueueDrawer = {
  mappedAttributes: ["id"],
  extends: "aside",
  style(self) {
    return `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(15px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    ${self} {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: 40vh;
      gap: 20px;
      padding: 20px;
      animation: fadeInUp 0.4s ease-out;
    }
    ${self} .buttons {
      align-self: start;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 20px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
      min-height: calc(40vh - 40px);
    }
    ${self} .buttons button {
      background: #f8fafc;
      color: var(--roi-theme-main-color);
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      font-size: 1rem;
      font-weight: 600;
      padding: 14px 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }
    ${self} .buttons button:hover:not(:disabled) {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      border-color: var(--roi-theme-main-color);
      box-shadow: 0 4px 12px rgba(43, 44, 58, 0.25);
      transform: translateY(-2px);
    }
    ${self} .buttons button:active:not(:disabled) {
      transform: translateY(0);
    }
    ${self} .buttons button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ${self} .buttons button.main {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      border: none;
      box-shadow: 0 2px 8px rgba(43, 44, 58, 0.2);
      font-size: 1.125rem;
      padding: 16px 18px;
    }
    ${self} .buttons button.main:hover:not(:disabled) {
      background: #1f2029;
      box-shadow: 0 6px 16px rgba(43, 44, 58, 0.35);
    }
    ${self} .buttons .settings {
      margin-top: auto;
      background: transparent;
      border: 1.5px solid #cbd5e1;
      color: #64748b;
      font-size: 0.9rem;
    }
    ${self} .buttons .settings:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #475569;
      transform: none;
      box-shadow: none;
    }
    ${self} .queue {
      padding: 24px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
    }
    ${self} .title {
      text-align: center;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--roi-theme-main-color);
      margin: 0 0 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
    }
    ${self} .info {
      background: #dbeafe;
      border: 1.5px solid #93c5fd;
      border-radius: 10px;
      color: #1e40af;
      padding: 14px 16px;
      margin: 0 0 20px;
      font-size: 0.95rem;
      line-height: 1.5;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    ${self} .info button {
      padding: 8px 16px;
      background: #1e40af;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-left: auto;
    }
    ${self} .info button:hover {
      background: #1e3a8a;
      box-shadow: 0 2px 8px rgba(30, 64, 175, 0.3);
    }
    ${self} roi-speeches-list {
    }
    ${self} roi-referendum {
      margin: 0 0 32px;
    }
    ${self} roi-referendum-result {
      margin: 0 0 32px;
    }
    ${self} .gfx-vote-iframe {
      border: none;
      border-radius: 12px;
      width: 100%;
      min-height: 280px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }
    @media (max-width: 768px) {
      ${self} {
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 12px;
      }
      ${self} .buttons {
        padding: 16px;
        min-height: auto;
      }
      ${self} .queue {
        padding: 16px;
      }
      ${self} .title {
        font-size: 1.375rem;
      }
    }
    `;
  },
  render({ useStore, useSel }) {
    const store = useStore();
    const {
      clientGfxIframe,
      clientUseWaitRoom,
      config,
      meeting,
      myself,
      referendum,
      referendumPrev,
      sak,
      speechFetching,
      speechInWhereby,
      speechesUpcomingByMe,
      testHasHad,
      test,
    } = useSel(
      "clientGfxIframe",
      "clientUseWaitRoom",
      "config",
      "meeting",
      "myself",
      "referendum",
      "referendumPrev",
      "sak",
      "speechFetching",
      "speechInWhereby",
      "speechesUpcomingByMe",
      "testHasHad",
      "test"
    );
    const title = `${sak?.title ? sak.title + " – " : ""}${meeting?.title}`;
    if (title && document.title !== title) {
      document.title = title;
    }
    const myNewestSpeechRequest = speechesUpcomingByMe.sort((a, b) => b.id - a.id)[0];
    let workArea = html`
      ${referendum ? html` <roi-referendum simple /> ` : null}
      ${referendum && clientGfxIframe ? html` <iframe class="gfx-vote-iframe" src="/gfx-vote.html"></iframe> ` : null}
      ${referendumPrev ? html` <roi-referendum-result /> ` : null}
      ${sak?.id ? html` <roi-speeches-list simple /> ` : null}
    `;

    this.html`
      <div class=buttons>
        ${
          !config.tests || config.waitRoom || testHasHad
            ? ""
            : html` <button .onclick=${() => store.doTestReq()}>Test</button> `
        }
        ${
          config.waitRoom && myNewestSpeechRequest && !speechInWhereby
            ? html`
                <button .onclick=${() => store.doClientUseWaitRoom(!clientUseWaitRoom)}>
                  ${clientUseWaitRoom ? "Gå ut av venterom" : "Gå inn i venterom"}
                </button>
              `
            : ""
        }
        ${
          sak?.id && !config.speechDisabled && !config.speechInnleggDisabled
            ? html`
                <button
                  tabindex="0"
                  class="main"
                  disabled=${speechFetching}
                  .onclick=${() => store.doSpeechReq()}
                  title=${`Før deg opp på talelista som ${myself?.name} (${myself?.num})`}
                >
                  Innlegg
                </button>
              `
            : null
        }
        ${
          sak?.id && !config.speechDisabled
            ? html`
                <button
                  tabindex="0"
                  disabled=${speechFetching}
                  .onclick=${() => store.doSpeechReq("REPLIKK")}
                  title=${`Før deg opp på talelista som ${myself?.name} (${myself?.num})`}
                >
                  Replikk
                </button>
              `
            : null
        }
        ${
          myNewestSpeechRequest
            ? html`
                <button
                  .onclick=${() => store.doSpeechEnd(myNewestSpeechRequest.id)}
                  title=${`Stryk din pågåande eller komande oppføring på talelista`}
                >
                  Stryk meg
                </button>
              `
            : ""
        }
        <button
          class=settings
          .onclick=${() => store.doClientUi("settings")}
          >Innstillingar</button>
      </div>
      <div class=queue>
        ${config.emoji ? html` <button .onclick=${() => store.doEmojiSend("like")}>Like</button> ` : null}
        ${
          test
            ? html`
                <div class="info">
                  Du er i ${!test.startedAt ? "kø for" : ""} ein prat på bakrommet.
                  <button .onclick=${() => store.doTestUpdateStatus(test?.id, "stop")}>Avbryt</button>
                </div>
              `
            : null
        }
        <h2 class=title>${sak?.title || "Inga sak"}</h2>
        ${workArea}
      </div>
    `;
  },
};

define("RoiQueue", {
  includes: { RoiQueueDrawer },
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} {
      display: block;
      min-height: 100vh;
      background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%);
    }
    `;
  },
  onchange(e) {
    const youtubeSize = e.target.form.youtubeSize?.value;
    this.store.doClientYoutubeSize(youtubeSize);
  },
  render({ useSel, useState, useStore, useEffect }) {
    this.store = useStore();
    const { clientUi, clientYoutubeSize } = useSel("clientUi", "clientYoutubeSize");
    this.html`
      <roi-video />
      <RoiQueueDrawer />
      ${clientUi == "settings" ? html` <roi-settings /> ` : null}
    `;
  },
});
