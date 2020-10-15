import { define, html } from "/web_modules/heresy.js";

define("RoiYoutube", {
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
        height="600"
        src="https://www.youtube.com/embed/${this.id}?autoplay=1"
        frameborder="0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    `;
  },
});
