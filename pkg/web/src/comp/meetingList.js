import { define, html } from "/web_modules/heresy.js";

import storage, { save } from "../lib/storage.js";

define("RoiMeetingList", {
  oninit() {
    this.meeting = storage("meeting");
  },
  style(self) {
    return ``;
  },
  onclick(event) {
    const a = event.target.closest("a");
    this.meeting.id = a.dataset.id;
    save("meeting");
  },
  render({ useEffect, useStore, useSel }) {
    const { id } = this.meeting;
    const { meetings, meetingId } = useSel("meetings", "meetingId");
    console.log({ meetings, meetingId });
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
      ${meetings.map(m => html`<li><a data-id=${m.id} href=${`/?m=${m.id}`}>${m.title || m.id}</a>`)}
    </ul>
    `;
  },
});
