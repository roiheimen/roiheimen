import { define, html } from "/web_modules/heresy.js";

import "../db/state.js";
import "../lib/whereby-embed.js"; // vendored this from https:/whereby.dev/embed/whereby-embed.js
import storage from "../lib/storage.js";

import "./youtube.js";

const WherebyEmbed = {
  style(self) {
    return `
    ${self} { 
      display: block;
      height: 100%;
    }
    ${self} whereby-embed {
      display: block;
      height: 100%;
    }
    `;
  },
  ondisconnected() {
    this.store.doWherebyParticipants(0);
  },
  onparticipantupdate({ detail: { count } }) {
    store.doWherebyParticipants(count);
  },
  render({ useSel, useStore, usePrevious, useEffect }) {
    this.store = useStore();
    const { wherebyActiveRoom: room, myself } = useSel("wherebyActiveRoom", "myself");
    const prevRoom = usePrevious(room);
    useEffect(() => {
      this.embed.addEventListener("participantupdate", this);
      // no cleanup needed, since the above call is idempotent
    }, []);
    if (!myself) return;
    if (!room) return this.html`You seem to have no room! Contact support.`;
    if (room === prevRoom) return;
    this.html`
      <whereby-embed
        ref=${(ref) => (this.embed = ref)}
        displayName=${myself?.name}
        embed
        people=off
        background=off
        room=${room} />
    `;
  },
};

define("RoiVideo", {
  includes: { WherebyEmbed },
  oninit() {
    this.creds = storage("creds");
  },
  style(self) {
    return `
    ${self} { 
      background: var(--roi-theme-video-bg);
      display: flex;
      height: 60vh;
    }
    ${self}:not(.bigyoutube) :nth-child(1) {
      flex: 1;
    }
    ${self}.bigyoutube :nth-child(2) {
      flex: 1;
    }

    `;
  },
  render({ useSel, useStore, useEffect }) {
    const youtubeId = "iK0qElBdeOM";

    const {
      speechFetching,
      speechInWhereby,
      speechScheduled,
      clientShowYoutube,
      clientYoutubeSize,
      wherebyActiveRoom,
    } = useSel(
      "speechFetching",
      "speechInWhereby",
      "speechScheduled",
      "clientYoutubeSize",
      "clientShowYoutube",
      "wherebyActiveRoom"
    );
    useEffect(() => {
      if (["big", "small"].includes(clientYoutubeSize)) {
        //this.classList.toggle("bigyoutube", clientYoutubeSize === "big" && !wherebyActiveRoom);
      }
    }, [clientYoutubeSize, wherebyActiveRoom]);

    if (speechFetching) {
      this.html`Waiting...`;
    } else {
      this.html`
        ${clientShowYoutube ? html`<roi-youtube .id=${youtubeId} />` : null}
        ${wherebyActiveRoom ? html`<WherebyEmbed .creds=${this.creds} />` : null}
      `;
    }
  },
});
