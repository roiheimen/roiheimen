import { define, html, ref } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { dedent } from "../lib/stringutil.js";
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
        speeches(condition: {endedAt: null}, orderBy: CREATED_AT_ASC) {
          nodes {
            id
            speakerId
          }
        }
      }
    }
  }`;
const gqlAllSaks = `
  query AllSaks {
    saks(orderBy: CREATED_AT_ASC, first: 100) {
      nodes {
        id
        title
        createdAt
        finishedAt
        referendums(orderBy: CREATED_AT_ASC) {
          nodes {
            id
            type
            title
            choices
          }
        }
        speeches(orderBy: CREATED_AT_ASC) {
          nodes {
            id
            speakerId
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
      choices.push("For", "Mot", "Avhaldande");
    }
    return { vote: { v: "OPEN", f: "OPEN", l: "CLOSED" }[line[0]], title, choices };
  }
}
function handleAdderAction(action, store) {
  if (action.speech) {
    const { speech: type, num } = action;
    const person = store.selectPeople().find((p) => p.num == +num);
    if (!person) {
      console.log("XXX people", type, num);
      throw new Error(`Fann ingen person med nummer ${+num}`);
    }
    if (type == "REPLIKK" && !store.selectSpeechState().current) {
      throw new Error(`Ingen replikk utan aktiv tale`);
    }
    return store.doSpeechReq(type, { speakerId: person.id, sakId: action.sakId });
  }
  if (action.vote) {
    return store.doReferendumReq({ type: action.vote, ...action });
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
    try {
      handleAdderAction(action, this.store);
    } catch (e) {
      this.err = e.message;
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

const SakList = {
  mappedAttributes: ["saks", "ondelsak", "peoplebyid"],
  style(self) {
    return `
    ${self} h3 {
      display: flex;
      background-color: #ffa;
      padding: 6px 20px;
      margin: 20px -20px 0;
      border: 1px solid #ddd;
      border-right: none;
      border-left: none;
    }
    ${self} h3.current {
      background-color: #cea;
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
    ${self} .speeches {
      background-color: #eee;
      padding: 0px 20px;
      margin: 0px -20px 6px;
    }
    ${self} .speech {
      font-size: 80%;
      display: inline-block;
      background-color: white;
      padding: 2px 4px;
      margin: 2px;
      border-radius: 2px;
      border: 1px solid #ccc;
    }
    ${self} ol {
      margin: 0;
      padding: 0 0 0 20px;
      list-style-type: "– ";
    }
    `;
  },
  ondelsak() {
    this.render();
  },
  onpeoplebyid() {
    this.render();
  },
  onsaks() {
    this.render();
  },
  onclick({
    target: {
      name,
      dataset: { id },
    },
  }) {
    if (name == "delete-sak") {
      this.dispatchEvent(new CustomEvent("deletesak", { detail: +id }));
    }
    if (name == "unfinish-sak") {
      this.dispatchEvent(new CustomEvent("unfinishsak", { detail: +id }));
    }
    this.render();
  },
  render({ useCallback, useStore, useEffect, useState, useSel }) {
    const saks = this.saks;
    this.html`
    ${saks.map(
      (s, i) => html`<div title=${"sak-id: " + s.id} class=${s.deleted ? "deleted" : ""}>
        <h3 class=${i == 0 ? "current" : ""}>
          ${s.title}
      ${s.deleted || s.finishedAt
            ? ""
            : html`<button type="button" onclick=${this} name="delete-sak" data-id=${s.id}>Slett</button>`}
          ${s.opened || !s.finishedAt
            ? ""
            : html`<button type="button" onclick=${this} name="unfinish-sak" data-id=${s.id}>Opne att</button>`}
        </h3>

        ${!s.speeches.nodes.length
          ? ""
          : html`<div class="speeches">
              Taleliste:
              ${s.speeches.nodes.map((speech) => {
                const speaker = this.peoplebyid?.[speech.speakerId];
                return html`<span class="speech" title=${speaker?.name + "\nspeech-id:" + speech.id}
                  >${speaker?.num || "?"}</span
                >`;
              })}
            </div>`}
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

const ShowSaker = {
  includes: {
    SakList,
  },
  render({ useCallback, useStore, useEffect, useState, useSel }) {
    this.store = useStore();
    const { peopleById } = useSel("peopleById");
    const [saks, setSaks] = useState([]);
    useEffect(async () => {
      const res = await gql(gqlAllOpenSaks);
      const saks = res.saks.nodes;
      setSaks(saks);
    }, []);
    const delSak = useCallback(({ detail: id }) => {
      const sak = saks.find((s) => s.id == id);
      this.store.doSakDelete(sak.id);
      sak.deleted = true;
      setSaks(saks);
      this.render();
    });
    this.html`<SakList saks=${saks} peoplebyid=${peopleById} ondeletesak=${delSak} />`;
  },
};

const FinishedSaker = {
  includes: {
    SakList,
  },
  render({ useCallback, useStore, useEffect, useState, useSel }) {
    this.store = useStore();
    const { peopleById } = useSel("peopleById");
    const [saks, setSaks] = useState([]);
    useEffect(async () => {
      const res = await gql(gqlAllSaks);
      const saks = res.saks.nodes;
      setSaks(saks);
    }, []);
    const unfinishSak = useCallback(({ detail: id }) => {
      const sak = saks.find((s) => s.id == id);
      this.store.doSakUpd({ sak, finishedAt: null });
      sak.opened = true;
      setSaks(saks);
      this.render();
    });
    this.html`<SakList saks=${saks} peoplebyid=${peopleById} onunfinishsak=${unfinishSak} />`;
  },
};

const MoreDialog = {
  extends: "dialog",
  includes: {
    ShowSaker,
    FinishedSaker,
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
    } else if (name === "action") {
      const sakId = +e.target.sakId.value;
      const errors = [];
      for (const v of e.target.adderlines.value.split("\n")) {
        if (!v) continue;
        const action = parseAdderLine(v);
        try {
          if (action.speech === "REPLIKK") throw new Error("Replikk gjev ikkje meining å leggja til her");
          await handleAdderAction({ ...action, sakId }, this.store);
        } catch (e) {
          errors.push(`'${v}': ${e.message}`);
        }
      }
      if (errors.length) {
        alert(dedent`
          Klarte ikkje fullføra alle kommandoane. Her er dei som feila:

          ${errors.join("\n")}
          `);
        return;
      }
    }
    e.target.querySelector("textarea").value = "";
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
      <h1>Administrer saker</h1>
      <ul class=tabs>
        <li><button onclick=${this} name=sak class=${this.tab === "sak" && "active"}>Lag nye saker</button>
        <li><button onclick=${this} name=action class=${
      this.tab === "action" && "active"
    }>Legg inn kommandoer på sak</button>
        <li><button onclick=${this} name=showsak class=${
      this.tab === "showsak" && "active"
    }>Sjå eller slett saker</button>
        <li><button onclick=${this} name=finished class=${
      this.tab === "finished" && "active"
    }>Ferdige saker</button>
      </ul>
      <form name=${this.tab}>
        ${
          {
            action: html`
              <label
                >Sak<br />
                <select name="sakId">
                  ${saks.map((s) => html` <option value=${s.id} selected=${sakId === s.id}>${s.title}</option> `)}
                </select>
              </label>
              <label
                >Kommandoer (t.d. avrøystinger og innlegg)<br />
                <textarea
                  cols="64"
                  rows="8"
                  name="adderlines"
                  placeholder="vEi avrøysting per line? @Ja @Det er korrekt @Må vera slik
fDu kan bruka ei for/mot avrøysting òg

20
53   <-- du kan òg leggja folk til på talelista!"
                ></textarea>
              </label>
              <input type="submit" name="sak" value="Legg til" />
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
              <input type="submit" name="action" value="Legg til" />
            `,
            showsak: html`<ShowSaker />`,
            finished: html`<FinishedSaker />`,
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
