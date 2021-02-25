import { define, html, ref } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

import "./speechesList.js";
import "./personList.js";
import "./referendumList.js";

const gqlAllOpenSaks = `
  query AllOpenSaks {
    saks(condition: {finishedAt: null}, orderBy: CREATED_AT_ASC, first: 100) {
      nodes {
        id
        title
        createdAt
        referendums(condition: {finishedAt: null}, orderBy: CREATED_AT_ASC) {
          nodes {
            id
            type
            title
            choices
          }
        }
      }
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
  if (["v", "l", "f"].includes(line[0])) {
    const [title, ...choices] = line
      .slice(1)
      .split("@")
      .map((p) => p.trim());
    if (line[0] === "f") {
      choices.push("For", "Mot", "Avhaldane");
    }
    return { vote: { v: "OPEN", f: "OPEN", l: "CLOSED" }[line[0]], title, choices };
  }
}

async function fetchPeople() {
  const res = await gql(gqlFetchPeople);
  const {
    people: { nodes },
  } = res;
  const byId = Object.fromEntries(nodes.map((p) => [p.id, p]));
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
  render() {},
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
    ${self} p {
      margin: 0;
      font-size: 0.8em;
      color: #666;
      line-height: 1;
    }
    ${self} code {
      background: #ccc;
      color: #333;
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
      const person = this.people.find((p) => p.num == +num);
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
        type,
      });
      const {
        createSpeech: { speech },
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
        delay: 2000,
      });
      await anim.finished;
      this.err = "";
    };
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
    ${this.err && html` <p ref=${onErrRef} class="err">${this.err}</p> `}
    <form>
      <input onkeydown=${this} name=adder placeholder="" autocomplete=off ref=${this.adder}>
      <input type=submit value="Legg til">
    </form>
    <p><small>Trykk Enter inni boks for neste. Skriv <code>12</code> for innlegg, <code>r12</code> replikk, <code>vDyr? @Katt @Andre</code> avrøysting, <code>fGlad?</code> for/mot/avh-avrøysting</small></p>
    `;
  },
};

const ShowSaker = {
  style(self) {
    return `
    ${self} h3 {
      margin-bottom: 0;
      display: flex;
    }
    ${self} h3 button {
      margin-left: auto;
    }
    ${self} .choice {
      font-size: 80%;
      display: inline-block;
      background-color: #ddd;
      padding: 2px 4px;
      margin: 2px;
      border-radius: 2px;
    }
    ${self} .deleted {
      text-decoration: line-through;
      color: #ccc;
    }
    ${self} ol {
      margin: 0;
      padding: 0 0 0 20px;
      list-style-type: "– ";
    }
    `;
  },
  onclick({
    target: {
      name,
      dataset: { id },
    },
  }) {
    if (name == "delete-sak") {
      console.log("delsak", id);
      this.store.doSakDelete(+id);
    }
    this.render();
  },
  render({ useCallback, useStore, useEffect, useState, useSel }) {
    this.store = useStore();
    const [saks, setSaks] = useState([]);
    useEffect(async () => {
      const res = await gql(gqlAllOpenSaks);
      const saks = res.saks.nodes;
      setSaks(saks);
    }, []);
    const delSak = useCallback(
      ({
        target: {
          name,
          dataset: { id },
        },
      }) => {
        if (name == "delete-sak") {
          console.log("delsak", id);
          id = +id;
          const sak = saks.find((s) => s.id == id);
          this.store.doSakDelete(sak.id);
          sak.deleted = true;
          setSaks(saks);
        }
        this.render();
      }
    );
    this.html`
    ${saks.map(
      (s) => html`<div title=${"sak-id: " + s.id} class=${s.deleted ? "deleted" : ""}>
        <h3>
          ${s.title}${s.deleted
            ? ""
            : html`<button type="button" onclick=${delSak} name="delete-sak" data-id=${s.id}>Slett</button>`}
        </h3>

        <ol>
        ${s.referendums.nodes.map(
          (r) => html`<li title=${"ref-id: " + r.id}>
            ${r.title} ${r.choices.map((c) => html` <span class="choice">${c}</span> `)}
          </div>`
        )}
        </ol>
      </div> `
    )}
    `;
  },
};

const MoreDialog = {
  extends: "dialog",
  includes: {
    ShowSaker,
  },
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
    ${self} input[type=submit] {
      align-self: flex-end;
      margin-top: 10px;
    }
    ${self} .tabs { padding: 0; }
    ${self} .tabs li {
      display: inline-block;
      list-style: none;
  }
    ${self} .tabs button {
      background: transparent;
      border: none;
      padding: 5px 20px;
      display: inline-block;
    }
    ${self} .tabs button.active {
      background: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2);
    }
    `;
  },
  onerr() {
    this.render();
  },
  async onsubmit(e) {
    e.preventDefault();
    const { name } = e.target;
    if (name === "sak") {
      for (const s of e.target.saker.value.split("\n")) {
        const st = s.trim();
        if (s) await this.store.doSakReq(s);
      }
    } else if (name === "vot") {
      const sakId = +e.target.sakId.value;
      for (const v of e.target.avroystinger.value.split("\n")) {
        const action = parseAdderLine(v);
        if (!action?.vote) continue;
        await this.store.doReferendumReq({ sakId, type: action.vote, ...action });
      }
    }
    this.close();
  },
  onclick(e) {
    this.tab = e.target.name;
    this.render();
  },
  render({ useStore, useSel }) {
    this.store = useStore();
    const { saks, sakId } = useSel("saks", "sakId");
    this.html`
      <h1>Legg til ting-og-tang</h1>
      <ul class=tabs>
        <li><button onclick=${this} name=sak class=${this.tab === "sak" && "active"}>Lag nye saker</button>
        <li><button onclick=${this} name=vot class=${this.tab === "vot" && "active"}>Lag avrøystinger</button>
        <li><button onclick=${this} name=showsak class=${this.tab === "showsak" && "active"}>Saker</button>
      </ul>
      <form name=${this.tab}>
        ${
          {
            vot: html`
              <label
                >Sak<br />
                <select name="sakId">
                  ${saks.map((s) => html` <option value=${s.id} selected=${sakId === s.id}>${s.title}</option> `)}
                </select>
              </label>
              <label
                >Avrøystinger<br />
                <textarea
                  cols="64"
                  rows="8"
                  name="avroystinger"
                  placeholder="vEi avrøysting per line? :Ja :Det er korrekt :Må vera slik
fDu kan bruka ei for/mot avrøysting òg"
                ></textarea>
              </label>
              <input type="submit" name="vot" value="Legg til" />
            `,
            sak: html`
              <label
                >Saker<br />
                <textarea
                  cols="64"
                  rows="8"
                  name="saker"
                  placeholder="Skriv inn sakene dine her
22/5: Ei sak per line!
Som dette :)"
                ></textarea>
              </label>
              <input type="submit" name="sak" value="Legg til" />
            `,
            showsak: html`<ShowSaker />`,
          }[this.tab]
        }
      </form>
      ${this.err && html` <p style="color:red">${this.err}</p> `}
    `;
  },
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
    const config = {
      speechDisabled: e.target.speechDisabled.checked,
      speechInnleggDisabled: e.target.speechInnleggDisabled.checked,
    };
    this.store.doSakReq(title, { config });
    this.close();
    e.preventDefault();
  },
  render({ useStore }) {
    this.store = useStore();
    this.html`
      <h1>Neste sak</h1>
      <form>
        <label>Tittel <input name=title placeholder="" required></label>
        <div class=config>
          <label><input name=speechDisabled type=checkbox> Taleliste stengt</label>
          <label><input name=speechInnleggDisabled type=checkbox> Innlegg stengt</label>
        </div>
        <input type=submit value="Legg til og bytt">
      </form>
      ${this.err && html` <p style="color:red">${this.err}</p> `}
    `;
  },
};

define("RoiManage", {
  includes: {
    MoreDialog,
    NewSakDialog,
    SakSpeakerAdderInput,
  },
  oninit() {
    this.newSakDialog = ref();
    this.moreDialog = ref();
  },
  style(self, dialog, more, adder) {
    return `
    ${self} {
      display: grid;
      grid-auto-rows: minmax(48px, auto);
      grid-template-columns: 1fr 1fr 100px;
      grid-template-areas:
        'title  title  finish'
        'config config update'
        'adder  adder  more'
        'list   list   list';
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
    ${self} .config { grid-area: config; }
    ${adder} { grid-area: adder; }
    ${more} { grid-area: more; }
    ${self} .list { grid-area: list; }
    ${self} .people {
      color: #666;
      grid-column: 1/4;
    }
    roi-referendum-list, roi-speeches-list {
      margin-bottom: 20px;
    }
    roi-speeches-list table {
        width: 100%;
    }
    ${self} h2 { text-align: center }
    roi-person-list table { width: 100% }
    `;
  },
  onclick({ target }) {
    if (target.classList.contains("new")) {
      this.newSakDialog.current.showModal();
    } else if (target.name === "more") {
      this.moreDialog.current.showModal();
    } else if (target.name == "update") {
      const title = this.querySelector(".title").value;
      const speechDisabled = this.querySelector(".speechDisabled").checked;
      const speechInnleggDisabled = this.querySelector(".speechInnleggDisabled").checked;
      this.store.doSakUpd({ title, config: { speechDisabled, speechInnleggDisabled } });
    } else {
      this.store.doSakFinish();
    }
  },
  render({ useSel, useStore }) {
    const { sak, config } = useSel("sak", "config");
    this.store = useStore();
    this.html`
      ${
        sak?.id
          ? html`
              <input class=title value=${sak?.title} title=${`sak-id: ${sak?.id}`} placeholder="Ingenting">
              <button class=finish onclick=${this}>Ferdig sak</button>
              <div class=config>
                <label><input class=speechDisabled type=checkbox checked=${
                  config.speechDisabled
                }> Taleliste stengt</label>
                <label><input class=speechInnleggDisabled type=checkbox checked=${
                  config.speechInnleggDisabled
                }> Innlegg stengt</label>
              </div>
              <button class=update name=update onclick=${this}>Oppdater</button>
              <SakSpeakerAdderInput />
              <button name=more onclick=${this}>Meir</button>
              <div class=list>
                <roi-speeches-list color />
                <roi-referendum-list />
              </list>
            `
          : html`<button class="new" name="new" onclick=${this}>Ny sak</button>`
      }

      <div class=people>
        <h2>Folk </h2>
        <roi-person-list editable />
      </div>
      <NewSakDialog ref=${this.newSakDialog} onnewsak=${this} />
      <MoreDialog ref=${this.moreDialog} />
    `;
  },
});
