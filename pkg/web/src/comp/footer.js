import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

function isActive(path) {
  const { pathname } = location;
  return pathname.includes(path) ? "active" : "";
}

define("RoiFooter<footer>", {
  observedAttributes: ["dark"],
  oninit() {
    this.creds = storage("creds");
    this.myself = storage("myself");
  },
  style(self) {
    return `
    ${self} {
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

  render() {
    this.html`
        <a href="index.html" class=${isActive("index") && "active"}>index</a>
        | <a href="queueing.html" class=${isActive("queueing") &&
          "active"}>talekø</a>
        ${this.myself?.admin &&
          html`
            |
            <a href="manage.html" class=${isActive("manage") && "active"}
              >manage</a
            >
            |
            <a href="admin.html" class=${isActive("admin") && "active"}
              >admin</a
            >
          `}
        | ${
          this.creds.num
            ? html`
                <a href="logout.html" class=${isActive("login") && "active"}
                  >logg ut</a
                >
              `
            : html`
                <a href="login.html" class=${isActive("login") && "active"}
                  >login</a
                >
              `
        }
      `;
  }
});
