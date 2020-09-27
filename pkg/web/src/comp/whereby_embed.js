import { define } from "/web_modules/heresy.js";

define("WherebyEmbed", {
  observedAttributes: ["room", "subdomain", "displayName"],
  style(self) {
    return `
    ${self} iframe {
      border: none;
      height: 100%;
      width: 100%;
    }
    `;
  },
  render() {
    const { displayName, subdomain, room } = this;
    if (!subdomain) return this.html`Whereby: Missing subdomain attr.`;
    if (!room) return this.html`Whereby: Missing room attr.`;
    const url = new URL(room, `https://${subdomain}.whereby.com`);
    url.search = new URLSearchParams({
      ...(displayName && { displayName }),
      background: "off",
      chat: "off",
      emptyRoomInvitation: "off",
      help: "off",
      iframeSource: subdomain,
      lang: "nb",
      precallReview: "off",
      recording: "off",
      roomIntegrations: "off",
      widescreen: "on"
    });
    console.log("url is: " + url);
    this.html`
      <iframe
        src=${url}
        allow="camera; microphone; fullscreen; speaker" />
      `;
  }
});
