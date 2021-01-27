import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import storage from "../lib/storage.js";

import "./speechesList.js";
import "./video.js";

define("RoiVideoOut", {
  mappedAttributes: ["type"],
  oninit() {
    const qs = new URLSearchParams(location.search);
    this.type = qs.get("type");
  },
  style(self) {
    return `
    ${self} {
      display: block;
      overflow: hidden;
      height: 100vh;
    }
    ${self} whereby-embed {
      display: block;
      height: 100%;
    `;
  },
  onclick(event) {
    this.type = event.target.value;
  },
  ontype(t) {
    if (this.type) {
      history.replaceState({}, "", new URL(`?type=${this.type}`, location.href));
    }
    this.render();
  },
  render({ useSel, usePrevious }) {
    const { speechState, peopleById, meeting } = useSel("speechState", "peopleById", "meeting");
    let room = meeting?.config.speechRoom;
    let speaker;
    if (!room) {
      const { current, next } = speechState;
      let speech;
      if (["c", "d"].includes(this.type)) {
        speech = current || next;
      } else {
        speech = { [current?.out]: current, [next?.out]: next }[this.type];
      }
      speaker = peopleById[speech?.speakerId];
      room = speaker?.room;
    }
    const prevRoom = usePrevious(room);
    if (!room) {
      if (!this.type) {
        return this.html`
        Video-out type?
          <button value=a onclick=${this}>a</button>
          <button value=b onclick=${this}>b</button>
          `;
      }
      return this.html`
      Nothing on out ${this.type} at the moment.
      ${speaker ? "Speaker has no room!" : ""}
      `;
    }
    if (room == prevRoom) return;
    this.html`
    <whereby-embed
      displayName=${this.type || meeting?.title}
      embed
      background=off
      room=${room + "?floatSelf&aec=off&agc=off"} />
    `;
  },
});
