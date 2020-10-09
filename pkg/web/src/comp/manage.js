import { define, html, ref } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

import "./speechesList.js";
import "./personList.js";
import "./referendumList.js";

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

export function parseAdderLine(line) {
  if (["r", "i"].includes(line[0]) || /\d/.test(line[0])) {
    let num;
    if (/\d/.test(line[0])) num = +line;
    else num = +line.slice(1);
    const speech = { r: "REPLIKK", i: "INNLEGG" }[line[0]] || "INNLEGG";
    return { speech, num };
  }
  if (["v", "l"].includes(line[0])) {
    const [title, ...choices] = line.slice(1).split(":").map(p => p.trim())
    return { vote: { v: "OPEN", l: "CLOSED" }[line[0]], title, choices };
  }
}

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
    `;
  },
  onsak() {
    this.render();
  },
  render() {
  }
};

const SakSpeakerAdderInput = {
  mappedAttributes: ["err"],
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
    const action = parseAdderLine(adder);
    if (action.speech) {
      const { speech: type, num } = action;
      if (!this.people.length) {
        console.log("XXX people is no WTF");
        this.people = this.store.selectPeople();
      }
      const person = this.people.find(p => p.num == +num);
      if (!person) {
        console.log("XXX people", this.people, type, num);
        this.err = `Fann ingen person med nummer ${+num}`;
        return;
      }
      if (type == "REPLIKK" && !this.store.selectSpeechState().current) {
        this.err = `Ingen replikk utan aktiv tale`;
        return;
      }
      this.store.doSpeechReq(type, { speakerId: person.id });
      return;
    }
    if (action.vote) {
      this.store.doReferendumReq({ type: action.vote, ...action });
      return;
    }
  },
  onkeydown(e) {
    const { key } = e;
    if (key == "Backspace") {
      if (!this.adder.current.value) {
        this.store.doSpeechPrev();
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
    const onErrRef = async (elm) => {
      const anim = elm.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 2000,
        fill: "both",
        delay: 2000
      });
      await anim.finished;
      this.err = "";
    }
    const { speechFetching, people } = useSel("speechFetching", "people");
    this.people = people;
    this.store = useStore();
    useEffect(() => {
      if (!speechFetching && this.adder.current.value) {
        this.adder.current.value = "";
        this.err = "";
      }
    }, [speechFetching]);
    this.html`
    ${this.err &&
      html`
        <p ref=${onErrRef} class="err">${this.err}</p>
      `}
    <form>
      <input onkeydown=${this} name=adder placeholder="12 for innlegg, r12 for replikk" autocomplete=off ref=${
      this.adder
    }>
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
    this.store.doSakReq(title);
    this.close();
    //this.newSak(title, () => {
    //  e.target.title.value = "";
    //});
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
  render({ useStore }) {
    this.store = useStore();
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
    SakSpeakerAdderInput,
  },
  oninit() {
    this.newSakDialog = ref();
  },
  style(self, dialog, adder) {
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
    ${self} .title {
      grid-area: title; 
      font-size: 24px;
      height: 100%;
      padding: 3px;
      width: 100%;
    }
    ${self} .finish { grid-area: finish; }
    ${adder} { grid-area: adder; }
    ${self} .list { grid-area: list; }
    ${self} .people {
      color: #666;
      grid-column: 1/4;
    }
    roi-referendum-list, roi-speeches-list {
      margin-bottom: 20px;
    }
    ${self} h2 { text-align: center }
    roi-person-list table { width: 100% }
    `;
  },
  onclick(e) {
    if (e.target.classList.contains("new")) {
      this.newSakDialog.current.showModal();
    } else {
      this.store.doSakFinish();
    }
  },
  render({ useSel, useStore }) {
    const { sak } = useSel("sak");
    this.store = useStore();
    this.html`
      ${
        sak?.id
          ? html`
              <input class=title value=${sak?.title} placeholder="Ingenting">
              <button class=finish onclick=${this}>Ferdig sak</button>
              <SakSpeakerAdderInput />
              <div class=list>
                <roi-referendum-list />
                <roi-speeches-list />
              </list>
            `
            : html`<button class=new onclick=${this}>Ny sak</button>`
      }

      <div class=people>
        <h2>Folk</h2>
        <roi-person-list />
      </div>
      <NewSakDialog ref=${this.newSakDialog} onnewsak=${this} />
    `;
  }
});
