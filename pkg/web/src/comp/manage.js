import { define, html, ref } from "/web_modules/heresy.js";

import { gql } from "../lib/graphql.js";

const SakTitle = {
  style(self) {
    return `
    ${self} {
    }
    ${self} input {
      font-size: 24px;
      height: 100%;
      padding: 3px;
      width: 100%;
    }
    `;
  },
  render() {
    this.html`<input value="SakTitle">`;
  },
}
const SakFinishButton = {
  style(self) {
    return `
    ${self} button {
      height: 100%;
      width: 100%;
    }
    `;
  },
  render() {
    this.html`<button>Neste sak</button>`;
  },
}
const SakSpeakerAdderInput = {
  style(self) {
    return `
    ${self} form {
      width: 100%;
      display: flex;
    }
    ${self} input[name=adder] {
      width: 100%;
    }
    ${self} input {
      padding: 3px;
    }
    `;
  },
  render() {
    this.html`
    <form>
      <input name=adder placeholder="12 for innlegg, r12 for replikk">
      <input type=submit value="Legg til">
    </form>
    `;
  },
}
const SakSpeakerList = {
  mappedAttributes: ["speakers"],
  style(self) {
    return `
    `;
  },
  render() {
    if (!this.speakers?.length) {
      return this.html`Ingen på lista`;
    }
    this.html`
      <table>
      <tr><th>Nummer <th>Namn </tr>
      ${this.speakers.map(
        user =>
          html`
            <tr>
              <td>${user.num}</td>
              <td>${user.name}</td>
            </tr>
          `
      )}
      </table>
      `;
  },
}

const NewSakDialog = {
  extends: "dialog",
  onitit() {
    this.addEventListener("submit", this);
  },
  style(self) {
    return `
    ${self} h1 {
      margin: 0 0 20px;
      font-size: 24px;
      text-align: center;
    }
    ${self} form {
      display: flex;
      flex-direction: column;
    }
    ${self}::backdrop {
      background-color: rgba(0, 0, 0, 0.5);
    }
    ${self} input {
      font-size: 16px;
      padding: 3px;
    }
    ${self} input[name=title] {
      width: 40em;
    }
    ${self} input[type=submit] {
      align-self: flex-end;
      margin-top: 10px;
    }
    `;
  },
  onsubmit(e) {
    console.log("XXX subm", e);
    const form = new FormData(e.currentTarget);
    const title = form.get("title");
    e.preventDefault();
  },
  async newSak(title) {
    const res = await gql(`
      mutation Login($num: Int!, $org: String!, $password: String!) {
        authenticate(input: {num: $num, subOrg: $org, password: $password}) {
          jwtToken
        }
      }`,
      { num, org, password }
    );
    console.log("XXX resnewsak", res);
  },
  render() {
    this.html`
      <h1>Neste sak</h1>
      <form>
        <label>Tittel <input name=title placeholder="" required></label>
        <input type=submit value="Legg til og bytt">
      </form>
    `;
  }
};

define("RoiManage", {
  includes: { SakTitle, SakFinishButton, SakSpeakerAdderInput, SakSpeakerList, NewSakDialog },
  oninit() {
    this.newSakDialog = ref();
  },
  style(self, title, finish, adder, list) {
    return `
    ${self} {
      display: grid;
      grid-auto-rows: minmax(48px, auto);
      grid-template-columns: 1fr 1fr 100px;
      grid-template-areas:
        'title title finish'
        'adder adder .'
        'list  list  list';
      grid-gap: 10px;
    }
    ${title} { grid-area: title; }
    ${finish} { grid-area: finish; }
    ${adder} { grid-area: adder; }
    ${list} { grid-area: list; }
    `;
  },
  onclick(e) {
    this.newSakDialog.current.showModal();
  },
  render() {
    this.html`
      <SakTitle />
      <SakFinishButton onclick=${this} />
      <SakSpeakerAdderInput />

      <SakSpeakerList />
      <NewSakDialog ref=${this.newSakDialog} />
    `;
  }
});
