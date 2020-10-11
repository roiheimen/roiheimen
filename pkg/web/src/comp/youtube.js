import { define } from "/web_modules/heresy.js";

define("RoiYoutube", {
  includes: { Video, YouTubeIframe },
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
  render() {
    this.html`

    `;
    //<Video .creds=${this.creds} />
  },
});
