import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

const gqlLogin = `
  mutation Login($num: Int!, $mId: String!, $password: String!) {
    authenticate(input: {num: $num, meetingId: $mId, password: $password}) {
      jwtToken
    }
  }`;
const gqlMyself = `
  query Myself {
    currentPerson {
      name
      id
      num
      meetingId
      admin
    }
  }`;

define("RoiLogin", {
  mappedAttributes: ["err"],
  oninit() {
    this.creds = storage("creds");
    this.err = null;
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
    ${self} .err {
      color: red;
      grid-column: 1 / 3;
    }
    `;
  },
  onsubmit(event) {
    this.err = null;
    const form = new FormData(event.currentTarget);
    const num = +form.get("num");
    const code = form.get("code");
    if (num && code) {
      this.creds.num = num;
      this.login(num, "nmlm12", code);
    }
    event.preventDefault();
  },
  onerr() { this.render() },
  async login(num, mId, password) {
    try {
      const res = await gql(gqlLogin, { num, mId, password }, { nocreds: true });
      const { jwtToken } = res.authenticate;
      if (!jwtToken) {
        this.err = ["Feil nummer/passord"];
        return;
      }
      this.creds.jwt = jwtToken;
      const res2 = await gql(gqlMyself);
      const { currentPerson } = res2;
      Object.assign(storage("myself"), currentPerson);
      if (currentPerson.admin) location.assign("/admin.html");
      else location.assign("/queueing.html");
    } catch(e) {
      if (e.extra?.body?.errors) {
        this.err = e.extra.body.errors.map(e => e.message);
        return;
      }
      this.err = [''+e];
    }
  },
  render() {
    this.html`
    <form onsubmit=${this}>
      <label>Nummer</label>
      <input name=num inputmode=numeric pattern="[1-9][0-9]*" value=${this.creds.num} />
      <label>Kode</label>
      <input name=code value=${this.creds.code} />
      ${this.err && this.err.map(e => html`<p class=err>${e}</p>`)}
      <span />
      <input type=submit value="Logg inn" />
    </form>
    `;
  }
});
