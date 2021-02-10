import { define, html } from "/web_modules/heresy.js";

import { themeToCss } from "../lib/boot.js";
import storage, { save } from "../lib/storage.js";

function toCss(theme) {
  return themeToCss(theme)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

define("RoiMeetingList", {
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
    this.store.doMeetingId(a.dataset.id);
    event.preventDefault();
  },
  render({ useEffect, useStore, useSel }) {
    this.store = useStore();
    const { meeting, meetingId, meetings } = useSel("meeting", "meetingId", "meetings");
    useEffect(() => {
      if (!meetings || meetingId === "" || meeting) return;
      const m = meetings?.find((m) => m.config.hostname === location.hostname);
      this.store.doMeetingId(m?.id || "");
    }, [location.hostname, meeting, meetings, this.store]);
    if (meeting) {
      return this.html`<roi-login>
        <p>Ver venleg og logg inn</p>
      </roi-login>
      <a data-id="" href=/ onclick=${this}>Tilbake</a>
        `;
    }
    if (!meetings || meetingId == null) return this.html`Lastar...`;
    this.html`
    Vel eit møte:
    <ul onclick=${this}>
      ${meetings.map(
        (m) => html` <li style=${toCss(m.theme)}>
          <a data-id=${m.id} href=${`/?m=${m.id}`}>
            <span>${m.title || m.id}</span>
          </a>
        </li>`
      )}
    </ul>
    `;
  },
});
