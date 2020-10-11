import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "https://whereby.dev/embed/whereby-embed.js";

const YouTubeIframe = {
  mappedAttributes: ["id"],
  style(self) {
    return `
    ${self} iframe {
      width: 100%;
      height: 100%;
    }`;
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
    const { myself } = useSel("myself");
    // You can set this to override the room or even full URL,
    // to use a mock website or local whereby if you have
    const room = localStorage.debug_room || myself?.room || "/test";
    this.html`
      <whereby-embed
        displayName=${myself?.name}
        embed
        people=off
        background=off
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
      background-image: url('https://www.nm.no/app/uploads/2020/03/framside_2.jpg'); /* #767d6f; */
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      display: block;
      height: 60vh;
    } `;
  },
  render({ useSel, useStore, useEffect }) {
    const youtubeId = "NMre6IAAAiU";
    const { speechFetching, speechScheduled, speechInWhereby } = useSel(
      "speechFetching",
      "speechScheduled",
      "speechInWhereby",
    );

    if (speechFetching) {
      this.html`Waiting...`;
    } else if (speechInWhereby) {
      this.html`<WherebyEmbed .creds=${this.creds} />`;
    } else {
      this.html`<YouTubeIframe .id=${youtubeId} />`;
    }
  }
});
