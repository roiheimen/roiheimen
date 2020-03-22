import { define } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";

define("RoiLogin", {
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} form {
      align-items: center;
      display: grid;
      grid-template-columns: auto auto;
      min-height: 142px;
    }
    ${self} input {
      border-radius: 2px;
      border: thin solid #aaa;
      padding: 10px;
    }
    ${self} input[type=submit] {
      margin: 0 0 0 auto;
      width: 100px;
    }
    `;
  },
  onsubmit(event) {
    const form = new FormData(event.target);
    const num = form.get("num");
    if (num) {
      this.creds.num = +num;
      location.assign("/queueing.html");
    }
    event.preventDefault();
  },
  render() {
    this.html`
    <form onsubmit=${this}>
      <label>Nummer</label>
      <input name=num inputmode=numeric pattern="[1-9][0-9]*" value=${this.creds.num} />
      <label>Kode</label>
      <input name=code value=${this.creds.code} />
      <span />
      <input type=submit value="Logg inn" />
    </form>
    `;
  }
});
