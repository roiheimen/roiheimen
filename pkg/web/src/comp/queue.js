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
      grid-template-columns: 220px 1fr;
      min-height: 40vh;
      gap: 20px;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    ${self} .buttons {
      align-self: start;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 20px;
      background: var(--roi-bg-surface);
      border-radius: var(--roi-radius-lg);
      box-shadow: var(--roi-shadow-md);
      min-height: calc(40vh - 40px);
    }
    ${self} .buttons button {
      background: var(--roi-bg-surface);
      color: var(--roi-primary);
      border: 2px solid var(--roi-border-medium);
      font-size: 1rem;
      font-weight: 500;
      padding: 14px 16px;
      cursor: pointer;
      transition: all var(--roi-transition-fast);
      border-radius: var(--roi-radius-md);
    }
    ${self} .buttons button:hover:not(:disabled) {
      background: var(--roi-primary);
      color: var(--roi-text-inverse);
      border-color: var(--roi-primary);
      transform: translateY(-1px);
    }
    ${self} .buttons button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ${self} .buttons button.main {
      background: linear-gradient(135deg, var(--roi-accent) 0%, var(--roi-accent-dark) 100%);
      color: #ffffff;
      border: none;
      font-weight: 600;
      font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
    }
    ${self} .buttons button.main:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
    }
    ${self} .buttons .settings {
      margin-top: auto;
      background: transparent;
      border: 1px solid var(--roi-border-light);
      color: var(--roi-text-tertiary);
      font-size: 0.875rem;
      padding: 10px 14px;
    }
    ${self} .buttons .settings:hover {
      background: var(--roi-bg-body);
      border-color: var(--roi-border-medium);
      color: var(--roi-text-secondary);
      transform: none;
    }
    ${self} .queue {
      padding: 24px;
      background: var(--roi-bg-surface);
      border-radius: var(--roi-radius-lg);
      box-shadow: var(--roi-shadow-md);
    }
    ${self} .title {
      text-align: center;
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--roi-primary);
      margin: 0 0 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--roi-border-light);
      letter-spacing: -0.5px;
    }
    ${self} .info {
      background: var(--roi-info-bg);
      border: 1px solid var(--roi-info-light);
      border-left: 4px solid var(--roi-info);
      color: var(--roi-info);
      padding: 14px 16px;
      margin: 0 0 20px;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      border-radius: var(--roi-radius-md);
    }
    ${self} .info button {
      padding: 8px 14px;
      background: var(--roi-info);
      color: var(--roi-text-inverse);
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-left: auto;
      border-radius: var(--roi-radius-sm);
      transition: background var(--roi-transition-fast);
    }
    ${self} .info button:hover {
      background: var(--roi-info-dark);
    }
    ${self} roi-referendum {
      margin: 0 0 24px;
    }
    ${self} roi-referendum-result {
      margin: 0 0 24px;
    }
    ${self} .gfx-vote-iframe {
      border: 1px solid var(--roi-border-light);
      border-radius: var(--roi-radius-md);
      width: 100%;
      margin-bottom: 20px;
    }
    @media (max-width: 768px) {
      ${self} {
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 16px;
      }
      ${self} .buttons {
        padding: 16px;
        min-height: auto;
        flex-direction: row;
        flex-wrap: wrap;
      }
      ${self} .buttons button {
        flex: 1;
        min-width: 120px;
      }
      ${self} .buttons .settings {
        width: 100%;
        margin-top: 8px;
      }
      ${self} .queue {
        padding: 16px;
      }
      ${self} .title {
        font-size: 1.3rem;
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
        ${referendumPrev ? html` <roi-referendum-result /> ` : null}
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
      background: var(--roi-bg-body);
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
