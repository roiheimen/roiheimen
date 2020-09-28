import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

const YouTubeIframe = {
  mappedAttributes: ["id"],
  style(self) {
    return ` ${self} {} `;
  },
  render() {
    this.html`
      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/${this.id}?autoplay=1"
        frameborder="0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    `;
  }
};

const WherebyEmbed = {
  mappedAttributes: ["creds"],
  style(self) {
    return `
    ${self} { 
      display: block;
      height: 100%;
    }`;
  },
  render() {
    // You can set this to override the room or even full URL,
    // to use a mock website or local whereby if you have
    const room = localStorage.debug_room || "/test";
    this.html`
      <whereby-embed
        subdomain="bitraf"
        displayName=${`Skilt ${this.creds.num}`}
        room=${room} />
    `;
  }
};

define("RoiVideo", {
  includes: { WherebyEmbed, YouTubeIframe },
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} { 
      background: #767d6f;
      display: block;
      grid-column: 2 / 3;
      grid-row: 1 / 3;
      height: 100%;
      min-height: 400px;
    } `;
  },
  render({ useSel, useStore, useEffect }) {
    const youtubeId = "NMre6IAAAiU";
    const { innleggFetching, innleggScheduled } = useSel(
      "innleggFetching",
      "innleggScheduled"
    );

    if (innleggFetching) {
      this.html`Waiting...`;
    } else if (innleggScheduled) {
      this.html`<WherebyEmbed .creds=${this.creds} />`;
    } else {
      this.html`<YouTubeIframe .id=${youtubeId} />`;
    }
  }
});
