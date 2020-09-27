import { define, html } from "/web_modules/heresy.js";

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
    return ` ${self} {} `;
  },
  render() {
    // You can set this to override the room or even full URL,
    // to use a mock website or local whereby if you have
    const room = localStorage.debug_room || "/room";
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
      grid-row: 1 / 3;
      grid-column: 2 / 3;
    } `;
  },
  render({ useDb, useEffect }) {
    const youtubeId = "NMre6IAAAiU";
    const [state, dispatch] = useDb();
    console.log("xxx state is", state);
    useEffect(() => {
      const id = setTimeout(() => {
        console.log("timeout");
        dispatch({ type: "set", payload: 5 });
      }, 2000);
      return () => clearTimeout(id);
    }, []);
    if (state.innleggScheduled) {
      this.html`<WherebyEmbed .creds=${this.creds} />`;
    } else if (state.youtube) {
      this.html`<YouTubeIframe .id=${youtubeId} />`;
    } else if (state.innleggFetching) {
      this.html`Waiting...`;
    } else {
      this.html`<button .onclick=${() =>
        dispatch({ type: "raise_hand" })}>Raise</button>`;
    }
  }
});
