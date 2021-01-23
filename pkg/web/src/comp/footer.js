import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

function isActive(path) {
  const { pathname } = location;
  return pathname.includes(path) ? "active" : "";
}

define("RoiFooter<footer>", {
  oninit() {
    this.nologout = this.getAttribute("nologout") != null;
  },
  style(self) {
    return `
    ${self} {
      margin-top: 28px;
      padding: 5px;
      text-align: center;
    }
    ${self} a {
      color: inherit;
      opacity: 0.9;
      text-decoration: none;
    }
    ${self} a:hover {
      opacity: 1;
    }
    ${self} .active {
      font-weight: bold;
    }
    `;
  },

  render({ useSel }) {
    const { myself } = useSel("myself");
    if (!myself?.admin) {
      if (this.nologout) return this.html`${null}`;
      return this.html`
        <a href="/?logout"}>
          logg ut
        </a>
      `;
    }
    this.html`
        <a href="queue.html" class=${isActive("queue") && "active"}>talekø</a>
        | <a href="manage.html" class=${isActive("manage") && "active"}>ordstyring</a>
        | <a href="admin.html" class=${isActive("admin") && "active"}>administrasjon</a>
        | <a href="backroom.html" class=${isActive("backroom") && "active"}>bakrom</a>
        ${this.nologout ? "" : html` | <a href="/?logout">logg ut</a>`}
      `;
  },
});
