import { define, html, ref } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

const gqlNewSak = `
  mutation NewSak($mId: String!, $title: String!) {
    createSak(input: {sak: {title: $title, meetingId: $mId}}) {
      sak {
        id
        title
      }
    }
  }`;
const gqlLatestSak = `
  query LatestSak {
    latestSak {
      id
      title
    }
  }`;

const SakTitle = {
  mappedAttributes: ["sak"],
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
  onsak() { this.render() },
  render() {
    console.log("-- title sak is", this.sak);
    this.html`<input value=${this.sak?.title} placeholder="Ingenting">`;
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
  oninit() {
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
    const form = new FormData(e.target);
    const title = form.get("title");
    console.log("XXX title", title);
    this.newSak(title, () => { e.target.title.value = "" });
    e.preventDefault();
  },
  async newSak(title, onFinish) {
    try {
      console.log(storage("myself"), "msylf")
      const res = await gql(gqlNewSak, { mId: storage("myself").meetingId, title });
      const { createSak: { sak } } = res;
      Object.assign(storage("sak"), sak);
      console.log("XXX resnewsak", sak);
      this.dispatchEvent(new CustomEvent("newsak", { detail: sak }));
      this.close();
      onFinish();
    } catch(e) {
      console.log("XXX e got err", e);
    }
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
  mappedAttributes: ["sak"],
  oninit() {
    this.newSakDialog = ref();
    if (!this.sak) {
      this.fetchLatestSak();
    }
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
  onclick() {
    this.newSakDialog.current.showModal();
  },
  onsak() { this.render() },
  onnewsak({ detail: sak }) {
    console.log("ONnewsak", sak);
    this.sak = sak;
    this.render();
  },
  async fetchLatestSak() {
    const res = await gql(gqlLatestSak);
    this.sak = res.latestSak;
  },
  render() {
    console.log("sak is", this.sak);
    this.html`
      <SakTitle sak=${this.sak} />
      <SakFinishButton onclick=${this} />
      <SakSpeakerAdderInput />

      <SakSpeakerList />
      <NewSakDialog ref=${this.newSakDialog} onnewsak=${this} />
    `;
  }
});
