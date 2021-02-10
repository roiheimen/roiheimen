import { define, html } from "/web_modules/heresy.js";

import storage, { save } from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

define("RoiLogin", {
  mappedAttributes: ["err"],
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
    ${self} label {
      padding-right: 4px;
    }
    ${self} input {
      border-radius: 2px;
      border: thin solid #aaa;
      padding: 10px;
      width: 100%;
    }
    ${self} input[type=submit] {
      margin: 0 0 0 auto;
      width: 100px;
    }
    ${self} .err {
      color: red;
      grid-column: 1 / 3;
    }
    `;
  },
  onsubmit(event) {
    const form = new FormData(event.currentTarget);
    const num = +form.get("num");
    const code = form.get("code");
    if (num && code) {
      this.creds.num = num;
      this.store.doMyselfLogin(num, code);
    }
    event.preventDefault();
  },
  onerr() {
    this.render();
  },
  render({ useEffect, useStore, useSel }) {
    this.store = useStore();
    const { myselfId, myselfErrors } = useSel("myselfId", "myselfErrors");
    useEffect(() => {
      if (myselfId) location.assign("/queue.html");
    }, [myselfId]);
    useEffect(() => {
      if (new URLSearchParams(location.search).has("logout")) {
        useStore().doMyselfLogout();
      }
    }, []);
    this.html`
    ${this.children}
    <form onsubmit=${this}>
      <label>Nummer</label>
      <input name=num inputmode=numeric pattern="[1-9][0-9]*" value=${this.creds.num} />
      <label>Kode</label>
      <input name=code value=${this.creds.code} />
      ${myselfErrors && myselfErrors.map((e) => html`<p class="err">${e}</p>`)}
      <span />
      <input type=submit value="Logg inn" />
    </form>
    `;
  },
});
