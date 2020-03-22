import { define } from "/web_modules/heresy.js";

define("RoiCard", {
  extends: "section",
  oninit() {
    this.content = [...this.children];
  },
  style(self) {
    return `
    ${self} {
      background-color: #fff;
      padding: 10px 20px;
      box-shadow:
        0 2px 4px 0 rgba(0, 0, 0, 0.2),
        0 25px 50px 0 rgba(0, 0, 0, 0.1);
      max-width: 500px;
      margin: 0 auto;
    }
    ${self}[lg] { max-width: 960px; }
    ${self}[sm] { max-width: 300px; }
    `;
  },
});
