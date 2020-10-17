import "https://whereby.dev/embed/whereby-embed.js";

import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
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
  render({ useSel }) {
    const { myself } = useSel("myself");
    if (!myself) return;
    const room = myself.room;
    if (!room) return this.html`You seem to have no room! Contact support.`;
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
      background-image: url('https://www.nm.no/app/uploads/2020/03/framside_2.jpg'); /* #767d6f; */
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      display: block;
      height: 60vh;
    } `;
  },
  render({ useSel, useStore, useEffect }) {
    //const youtubeId = "d2Xeg1VaZhg";
    //const youtubeId = "tk293jhBq78";
    //const youtubeId = "KtxBVl4ArhM";
    //const youtubeId = "V56xHl7x93w";
    //const youtubeId = "yXQzvGWvU80";
    const youtubeId = "-qJTsRn0kpQ";
    const { speechFetching, speechScheduled, speechInWhereby, testActive } = useSel(
      "speechFetching",
      "speechScheduled",
      "speechInWhereby",
      "testActive"
    );

    if (speechFetching) {
      this.html`Waiting...`;
    } else if (speechInWhereby || testActive) {
      this.html`<WherebyEmbed .creds=${this.creds} />`;
    } else {
      this.html`<roi-youtube .id=${youtubeId} />`;
    }
  },
});
