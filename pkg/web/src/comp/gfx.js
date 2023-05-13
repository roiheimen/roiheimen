import { define, html, ref } from "/web_modules/heresy.js";

import "../db/state.js";

function voteToClass(vote) {
  const v = vote?.toLowerCase();
  if (["ja", "jo", "yes", "for", "godta"].includes(v)) return "yes";
  if (["nei", "no", "mot", "avslå"].includes(v)) return "no";
  return "";
}

define("RoiGfxTitle", {
  style(self) {
    return `
      ${self} h1 {
        background: #6A9325;
        color: white;
        font-size: 3.5vw;
        font-weight: 600;
        margin: 0 auto;
        padding: 0 1vw;
        opacity: 1;
        transform-origin: top right;
        will-change: transform;
      }
      ${self} h1:not(.simple) {
        transform: scale(0.6);
        display: inline-block;
        line-height: 1;
      }
      ${self} h1.simple {
        padding: 0;
        font-size: inherit;
        transform-origin: top center;
      }
    `;
  },
  oninit() {
    this.h1 = ref();
    this.simple = this.getAttribute("simple") != null;
  },
  render({ useEffect, useSel, usePrevious }) {
    const { sak } = useSel("sak");
    const title = sak?.title;
    //const prevTitle = usePrevious(title);
    //if (prevTitle && prevTitle == title) return;
    useEffect(() => {
      if (!this.h1.current || this.simple) return;
      const DURATION = 5000;
      const SCALE = 0.6;
      this.h1.current.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1)", offset: 0.99 }, { transform: `scale(${SCALE})` }],
        { duration: DURATION, easing: "ease-out" }
      );
    }, [this.h1, title]);
    this.html`
      <h1 class=${this.simple ? "simple" : ""} ref=${this.h1}>${title}</h1>
    `;
  },
});

define("RoiGfxSpeaker", {
  style(self) {
    return `
      ${self} .box {
        font-weight: 600;
        margin: 0 auto;
        opacity: 0;
        position: relative;
        will-change: transform opacity;
      }
      ${self} .topbox {
        background: #6A9325;
        display: block;
        color: white;
        font-size: 2.5vw;
        padding: 2px 1vw;
      }
      ${self} .underbox {
        color: #333;
        font-size: 1.8vw;
        margin-top: 0.5vw;
      }
      ${self} .underbox > div {
        background: #fff;
        display: inline-block;
        padding: 0 1vw;
      }
      ${self} .hidden {
        /*
        opacity: 0.0001;
        right: -2vw;
        */
      }
    `;
  },
  oninit() {
    this.div = ref();
  },
  render({ useEffect, useSel, useState, usePrevious }) {
    const { speechState, peopleById } = useSel("speechState", "peopleById");
    const [isHidden, setIsHidden] = useState(true);
    const speech = speechState.current;
    const person = peopleById[speech?.speakerId];
    //const prevTitle = usePrevious(title);
    //if (prevTitle && prevTitle == title) return;
    useEffect(() => {
      if (!this.div.current) return;
      const DURATION = 30000;
      this.div.current.animate(
        [
          { opacity: 0, transform: "translateX(-100px)" },
          { opacity: 1, transform: "translateX(0)", offset: 0.05 },
          { opacity: 1, transform: "translateX(0)", offset: 0.99 },
          { opacity: 0, transform: "translateX(-50px)" },
        ],
        { duration: DURATION, easing: "ease-out" }
      );
    }, [this.div.current, person]);
    this.html`
      <div ref=${this.div} class=${"box" + (isHidden ? " hidden" : "")}>
        <div class=topbox>
          <div class=name>${person?.name}</div>
        </div>
        <div class=underbox>
          <div class=number>${person?.num}</div>
          <div class=group>${person?.org}</div>
          <div class=reply>${speech?.parentId ? "replikk" : ""}</div>
        </div>
      </div>
    `;
  },
});

define("RoiGfxVote", {
  oninit() {
    this.div = ref();
    this.noheader = this.getAttribute("noheader") != null;
  },
  style(self) {
    return `
      ${self} .refbox {
        display: block;

        transform: translateY(0);
        opacity: 1;
        will-change: transform opacity;

        color: white;
        /* border: 2px solid #d94b8e; */
        padding: 10px 10px 5vh;
        border-radius: 2px;
        background: white;

        font-size: 10pt;
        font-weight: 600;
        line-height: 1;
      }
      ${self} h2 {
        background: #d94b8e;
        display: inline-block;
        margin: 3px;
        padding: 2px 6px;
        font-size: var(--roi-vote-header-size, revert);
      }
      ${self} .vote {
        display: inline-block;
        margin: 2px;
        padding: 2px 3px;
        font-weight: 400;
      }
      ${self} .type-CLOSED .vote {
        margin: 2px 0;
      }
      ${self} .voted {
        background-color: #333;
      }
      ${self} .voted.yes {
        background-color: #6A9325;
      }
      ${self} .voted.no {
        background-color: #d94b8e;
      }
      ${self} .not_voted {
        background-color: #ccc;
      }
    `;
  },
  render({ useEffect, useStore, useSel, usePrevious }) {
    const { config, referendum, peopleDelegates } = useSel("config", "referendum", "peopleDelegates");
    const store = useStore();
    const title = referendum?.title;
    const votesByPerson = referendum?.votes.nodes.reduce((o, v) => ({ ...o, [v.personId]: v }), {}) || {};
    const isClosed = referendum?.type === "CLOSED";
    useEffect(() => {
      if (isClosed) return;
      store.doReferendumCount();
      const i = setInterval(() => store.doReferendumCount(), 5000);
      return () => clearInterval(i);
    }, [referendum?.type]);
    useEffect(() => {
      if (!this.div.current) return;
      const DURATION = 500;
      const SCALE = 0.6;
      this.div.current.animate(
        [
          { transform: "translateY(100px)", opacity: 0 },
          { transform: `translateY(0)`, opacity: 1 },
        ],
        { duration: DURATION, easing: "ease-out" }
      );
    }, [this.div, title]);
    if (!title) return this.html`<div></div>`;
    const hideResult = isClosed && config.hideClosedReferendumResults;
    this.html`
      <div class=refbox ref=${this.div}>
        ${this.noheader ? null : html` <h2>${title}</h2> `}
        <div class=${`ppl type-${referendum.type}`}>
          ${peopleDelegates?.map((p, i) => {
            let name = p.num;
            let cn = "not_voted";
            if (referendum.type === "CLOSED") {
              name = "  "; // nbsp :shrug:
              let doneVotes = 0;
              for (const c of referendum.counts) {
                doneVotes += c.privateCount;
                if (doneVotes > i) {
                  cn = `voted ${hideResult ? "" : voteToClass(c.choice)}`.trim();
                  break;
                }
              }
            } else {
              const v = votesByPerson[p.id];
              if (v) cn = `voted ${hideResult ? "" : voteToClass(v.vote)}`.trim();
            }
            cn = `vote ${cn}`;
            return html` <div class=${cn}>${name}</div> `;
          })}
        </div>
      </div>
    `;
  },
});
