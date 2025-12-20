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
      margin-top: 32px;
      padding: 16px;
      text-align: center;
      background: var(--roi-bg-body);
      border-top: 1px solid var(--roi-border-light);
      font-size: 0.9rem;
    }
    ${self} a {
      color: var(--roi-text-secondary);
      text-decoration: none;
      padding: 6px 10px;
      border-radius: var(--roi-radius-sm);
      transition: all var(--roi-transition-fast);
    }
    ${self} a:hover {
      color: var(--roi-accent);
      background: var(--roi-bg-surface);
    }
    ${self} a:visited {
      opacity: 1;
    }
    ${self} .active {
      font-weight: 600;
      color: var(--roi-primary);
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
        ${this.nologout ? "" : html` | <a href="/?logout">logg ut</a> `}
      `;
  },
});
