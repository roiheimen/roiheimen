import { define } from "/web_modules/heresy.js";

define("RoiTitle", {
  extends: "h1",
  render({ useSel }) {
    const { meeting } = useSel("meeting");
    this.html`${this.children} ${meeting?.title || '–'}`;
  },
});
