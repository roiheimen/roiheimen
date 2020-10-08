import { define, html, ref } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

import "./speechesList.js";
import "./personList.js";

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
const gqlCreateSpeech = `
  mutation CreateSpeech($speakerId: Int!, $type: SpeechType!) {
    createSpeech(input: {speech: {speakerId: $speakerId, type: $type}}) {
      speech {
        id
        speakerId
      }
    }
  }`;
const gqlFetchPeople = `
query FetchPeople {
  people {
    nodes {
      id
      name
      num
      admin
      nodeId
    }
  }
}`;

async function fetchPeople() {
  const res = await gql(gqlFetchPeople);
  const {
    people: { nodes }
  } = res;
  const byId = Object.fromEntries(nodes.map(p => [p.id, p]));
  storage("people").byId = byId;
  return byId;
}

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
  onsak() {
    this.render();
  },
  render() {
    this.html`<input value=${this.sak?.title} placeholder="Ingenting">`;
  }
};
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
  }
};
const SakSpeakerAdderInput = {
  mappedAttributes: ["people", "err"],
  oninit() {
    this.addEventListener("submit", this);
    this.adder = ref();
  },
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
    ${self} .err {
      position: absolute;
      color: white;
      background-color: red;
      pointer-events: none;
      font-size: 20px;
      margin: 0;
      right: 20px;
      padding: 5px 28px;
    }
    `;
  },
  onpeople() {
    this.personIdByNum = new Map(
      Object.values(this.people).map(p => [p.num, p.id])
    );
  },
  onerr() {
    this.render();
  },
  onsubmit(e) {
    e.preventDefault();
    const adder = e.target.adder.value.trim();
    if (!adder) {
      // do the enter thing
      this.store.doSpeechNext();
      return;
    }
    const [type_, num] = /^(r|i|)(\d+)$/.exec(adder)?.slice(1, 3) || [];
    const type = { r: "REPLIKK", i: "INNLEGG" }[type_ || "i"];
    const personId = this.personIdByNum.get(+num);
    if (!personId) {
      this.err = `Fann ingen person med nummer ${+num}`;
      return;
    }
    this.store.doReqInnlegg(type, personId);
  },
  onkeydown(e) {
    const { key } = e;
    if (key == "Backspace") {
      if (!this.adder.current.value) {
        store.doSpeechPrev();
        return;
      }
    }
  },
  async newSpeech(type, speakerId, onFinish) {
    try {
      const res = await gql(gqlCreateSpeech, {
        speakerId,
        type
      });
      const {
        createSpeech: { speech }
      } = res;
      onFinish();
    } catch (e) {
      console.error("new speech error", e);
      this.err = "" + e;
    }
  },
  render({ useStore, useSel, useEffect, useRef }) {
    function onErrRef(elm) {
      elm.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 2000,
        fill: "both",
        delay: 2000
      });
    }
    const { innleggFetching } = useSel("innleggFetching");
    this.store = useStore();
    useEffect(() => {
      if (!innleggFetching && this.adder.current.value) {
        this.adder.current.value = '';
      }
    }, [innleggFetching]);
    this.html`
    ${this.err &&
      html`
        <p ref=${onErrRef} class="err">${this.err}</p>
      `}
    <form>
      <input onkeydown=${this} name=adder placeholder="12 for innlegg, r12 for replikk" autocomplete=off ref=${this.adder}>
      <input type=submit value="Legg til">
    </form>
    `;
  }
};

const NewSakDialog = {
  extends: "dialog",
  mappedAttributes: ["err"],
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
  onerr() {
    this.render();
  },
  onsubmit(e) {
    const title = e.target.title.value;
    this.newSak(title, () => {
      e.target.title.value = "";
    });
    e.preventDefault();
  },
  async newSak(title, onFinish) {
    try {
      const res = await gql(gqlNewSak, {
        mId: storage("myself").meetingId,
        title
      });
      const {
        createSak: { sak }
      } = res;
      Object.assign(storage("sak"), sak);
      this.dispatchEvent(new CustomEvent("newsak", { detail: sak }));
      this.close();
      onFinish();
    } catch (e) {
      console.error("new sak error", e);
      this.err = "" + e;
    }
  },
  render() {
    this.html`
      <h1>Neste sak</h1>
      <form>
        <label>Tittel <input name=title placeholder="" required></label>
        <input type=submit value="Legg til og bytt">
      </form>
      ${this.err &&
        html`
          <p style="color:red">${this.err}</p>
        `}
    `;
  }
};

define("RoiManage", {
  includes: {
    NewSakDialog,
    SakFinishButton,
    SakSpeakerAdderInput,
    SakTitle,
  },
  mappedAttributes: ["sak", "people"],
  oninit() {
    this.newSakDialog = ref();
    if (!this.sak) {
      this.fetchLatestSak();
    }
    if (!this.people) {
      this.people = [];
      fetchPeople().then(people => {
        this.people = people;
      });
    }
  },
  style(self, dialog, finish, adder, title) {
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
    roi-speeches-list { grid-area: list; }
    ${self} .people {
      color: #666;
      grid-column: 1/4;
    }
    ${self} h2 { text-align: center }
    roi-person-list table { width: 100% }
    `;
  },
  onpeople() {
    this.render();
  },
  onsak() {
    this.render();
  },
  onclick() {
    this.newSakDialog.current.showModal();
  },
  onnewsak({ detail: sak }) {
    this.sak = sak;
    this.render();
  },
  async fetchLatestSak() {
    const res = await gql(gqlLatestSak);
    this.sak = res.latestSak;
  },
  render() {
    this.html`
      <SakTitle sak=${this.sak} />
      <SakFinishButton onclick=${this} />
      <SakSpeakerAdderInput people=${this.people} />

      <roi-speeches-list />
      <div class=people>
        <h2>Folk</h2>
        <roi-person-list />
      </div>
      <NewSakDialog ref=${this.newSakDialog} onnewsak=${this} />
    `;
  }
});
