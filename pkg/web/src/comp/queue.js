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
    ${self} {
      display: grid;
      grid-template-columns: 200px 1fr;
      min-height: 40vh;
      gap: 16px;
      padding: 16px;
    }
    ${self} .buttons {
      align-self: start;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: #fff;
      border: 1px solid #e5e5e5;
      min-height: calc(40vh - 32px);
    }
    ${self} .buttons button {
      background: #fafafa;
      color: var(--roi-theme-main-color);
      border: 1px solid #ddd;
      font-size: 1rem;
      font-weight: 500;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    ${self} .buttons button:hover:not(:disabled) {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      border-color: var(--roi-theme-main-color);
    }
    ${self} .buttons button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ${self} .buttons button.main {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      border-color: var(--roi-theme-main-color);
      font-weight: 600;
    }
    ${self} .buttons button.main:hover:not(:disabled) {
      opacity: 0.9;
    }
    ${self} .buttons .settings {
      margin-top: auto;
      background: transparent;
      border: 1px solid #ccc;
      color: #666;
      font-size: 0.9rem;
    }
    ${self} .buttons .settings:hover {
      background: #f5f5f5;
      border-color: #999;
    }
    ${self} .queue {
      padding: 20px;
      background: #fff;
      border: 1px solid #e5e5e5;
    }
    ${self} .title {
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--roi-theme-main-color);
      margin: 0 0 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e5e5;
    }
    ${self} .info {
      background: #f0f7ff;
      border: 1px solid #cce0ff;
      color: #1a4d80;
      padding: 12px 14px;
      margin: 0 0 16px;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    ${self} .info button {
      padding: 6px 12px;
      background: #1a4d80;
      color: white;
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-left: auto;
    }
    ${self} .info button:hover {
      background: #133a61;
    }
    ${self} roi-referendum {
      margin: 0 0 24px;
    }
    ${self} roi-referendum-result {
      margin: 0 0 24px;
    }
    ${self} .gfx-vote-iframe {
      border: 1px solid #e5e5e5;
      width: 100%;
      margin-bottom: 16px;
    }
    @media (max-width: 768px) {
      ${self} {
        grid-template-columns: 1fr;
        gap: 12px;
        padding: 12px;
      }
      ${self} .buttons {
        padding: 12px;
        min-height: auto;
      }
      ${self} .queue {
        padding: 14px;
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
      peopleDelegates,
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
      "peopleDelegates",
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
    // Calculate iframe height: ~18 chips per row, ~28px per row + padding
    const delegateCount = peopleDelegates?.length || 0;
    const iframeHeight = Math.ceil(delegateCount / 18) * 28 + 24;
    let workArea = html`
      ${referendum ? html` <roi-referendum simple /> ` : null}
      ${referendum && clientGfxIframe ? html` <iframe class="gfx-vote-iframe" style="height: ${iframeHeight}px" src="/gfx-vote.html"></iframe> ` : null}
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
      background: #f5f5f5;
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
