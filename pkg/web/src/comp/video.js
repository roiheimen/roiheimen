import { define } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

const Video = {
  mappedAttributes: ["creds"],
  style(self) {
    return `
    ${self} whereby-embed {
      height: 640px;
      max-height: 90%;
    }
    `;
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
  includes: { Video },
  oninit() {
    this.creds = storage("creds");
  },
  render() {
    this.html`
    <Video .creds=${this.creds} />
    `;
  }
});
