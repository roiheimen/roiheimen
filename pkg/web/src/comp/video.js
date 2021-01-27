import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import "../lib/whereby-embed.js"; // vendored this from https:/whereby.dev/embed/whereby-embed.js
import storage from "../lib/storage.js";

import "./youtube.js";

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
    }
    `;
  },
  render({ useSel, usePrevious }) {
    const { myself } = useSel("myself");
    if (!myself) return;
    const room = myself.room;
    const prevRoom = usePrevious(room);
    if (!room) return this.html`You seem to have no room! Contact support.`;
    if (room === prevRoom) return;
    this.html`
      <whereby-embed
        displayName=${myself?.name}
        embed
        people=off
        background=off
        room=${room} />
    `;
  },
};

define("RoiVideo", {
  includes: { WherebyEmbed },
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} { 
      background: var(--roi-theme-video-bg);
      display: flex;
      height: 60vh;
    }
    ${self}:not(.bigyoutube) :nth-child(1) {
      flex: 1;
    }
    ${self}.bigyoutube :nth-child(2) {
      flex: 1;
    }

    `;
  },
  render({ useSel, useStore, useEffect }) {
    //const youtubeId = "d2Xeg1VaZhg";
    //const youtubeId = "tk293jhBq78";
    //const youtubeId = "KtxBVl4ArhM";
    //const youtubeId = "V56xHl7x93w";
    //const youtubeId = "yXQzvGWvU80";
    //const youtubeId = "8BuXWdlwlEc";
    //const youtubeId = "-lMCCA47IRY";
    const youtubeId = "mBwwjtRy7sI";
    const { speechFetching, speechInWhereby, speechScheduled, clientYoutubeSize, clientWherebyActive } = useSel(
      "speechFetching",
      "speechInWhereby",
      "speechScheduled",
      "clientYoutubeSize",
      "clientWherebyActive",
    );
    useEffect(() => {
      if (["big", "small"].includes(clientYoutubeSize)) {
        this.classList.toggle("bigyoutube", clientYoutubeSize === "big" && !clientWherebyActive);
      }
    }, [clientYoutubeSize]);

    if (speechFetching) {
      this.html`Waiting...`;
    } else {
      const showYoutube = clientYoutubeSize !== "none" && !speechInWhereby;
      this.html`
        ${showYoutube ? html`<roi-youtube .id=${youtubeId} />` : null}
        ${clientWherebyActive ? html`<WherebyEmbed .creds=${this.creds} />` : null}
      `;
    }
  },
});
