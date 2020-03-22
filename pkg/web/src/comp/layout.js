import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

function isActive(path) {
  const { pathname } = location;
  return pathname.includes(path) ? "active" : "";
}

define("RoiLayout", {
  oninit() {
    this.content = [...this.children];
    this.creds = storage("creds");
  },
  style(self) {
    return `
    body {
      background-color: #eeefee;
      font-family: "sans-serif";
      color: #333;
    }
    h1, h2, h3 {
      font-weight: normal;
    }
    a { color: #459745; }
    a:visited { color: #5a8d51; }
    ${self} > header {
      display: flex;
    }
    ${self} > header > h1 {
      color: #459745;
      font-size: 42px;
      margin: 10px auto;
    }
    ${self} > header span {
      color: #888;
      font-size: 20px;
      font-weight: 600;
      top: 10px;
      position: relative;
    }
    ${self} > footer {
      margin-top: 10px;
      text-align: center;
    }
    ${self} > footer .active {
      color: black;
      font-weight: bold;
    }
    `;
  },
  render() {
    this.html`
      <header>
        <h1>
          <span>Ro i heimen</span><br>
          Test-organisasjon
        </h1>
      </header>
      ${this.content}
      <footer>
        <a href="index.html" class=${isActive("index") && "active"}>index</a>
        | <a href="queueing.html" class=${isActive("queueing") &&
          "active"}>talekø</a>
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
      </footer>
    `;
  }
});
