import { define, html, createContext } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./footer.js";

function isActive(path) {
  const { pathname } = location;
  return pathname.includes(path) ? "active" : "";
}

define("RoiMeetingLayout", {
  oninit() {
    this.content = [...this.children];
    this.creds = storage("creds");
  },
  style(self) {
    return `
    body {
      background-color: #eeefee;
      color: #333;
      display: grid;
      font-family: "sans-serif";
    }
    h1, h2, h3 {
      font-weight: normal;
    }
    a {
      color: #ddd;
      text-decoration: none;
    }
    ${self} {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr 2em;
      position: fixed;
      top: 0;
      bottom: 0;
      right: 0;
      left: 0;
      overflow: hidden;
    }
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
      color: white;
      background: #5f6458;
      grid-column: 1 / 3;
      grid-row: 3;
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
      <footer is="roi-footer" data-dark=dark />
    `;
  }
});
