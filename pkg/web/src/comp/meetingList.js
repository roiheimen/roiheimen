import { define, html } from "/web_modules/heresy.js";

import { themeToCss } from "../lib/boot.js";
import storage, { save } from "../lib/storage.js";

function toCss(theme) {
  return themeToCss(theme).map(([k, v]) => `${k}: ${v}`).join("; ");
}

define("RoiMeetingList", {
  oninit() {
    this.meeting = storage("meeting");
    if (!this.meeting) {
      console.warn("Setting meeting to meet20 directly");
      this.meeting.id = a.dataset.id;
      save("meeting");
    }
  },
  style(self) {
    return `
    ${self} ul {
      padding: 0;
    }
    ${self} li {
      list-style: none;
    }
    ${self} li a {
      background: var(--roi-theme-main-color);
      height: 100px;
      color: var(--roi-theme-main-color2);
      display: flex;
      text-decoration: none;
    }
    ${self} li span {
      margin: auto;
    }
    `;
  },
  onclick(event) {
    const a = event.target.closest("a");
    this.meeting.id = a.dataset.id;
    save("meeting");
  },
  render({ useEffect, useStore, useSel }) {
    const { id } = this.meeting;
    const { meetings, meetingId } = useSel("meetings", "meetingId");
    if (meetingId) {
      return this.html`<roi-login>
        <p>Ver venleg og logg inn</p>
      </roi-login>
      <a data-id="" href=/ onclick=${this}>Tilbake</a>
        `;
    }
    if (!meetings) return this.html`Lastar...`
    this.html`
    Vel eit møte:
    <ul onclick=${this}>
      ${meetings.map(m => html`
        <li style=${toCss(m.theme)}>
          <a data-id=${m.id} href=${`/?m=${m.id}`}>
            <span>${m.title || m.id}</span>
          </a>
        </li>`)}
    </ul>
    `;
  },
});
