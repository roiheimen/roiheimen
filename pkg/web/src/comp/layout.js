import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

import "./footer.js";

define("RoiLayout", {
  oninit() {
    this.content = [...this.children];
  },
  style(self) {
    return `
    ${self} { display: block }
    body {
      background-color: #eeefee;
      font-family: "sans-serif";
      display: grid;
      color: #333;
      margin: 0;
    }
    input, textarea { box-sizing: border-box }
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
      <footer is="roi-footer" />
    `;
  }
});
