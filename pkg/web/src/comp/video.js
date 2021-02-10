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
  async onparticipantupdate({ detail: { count } }) {
    if (this.store.selectClientShowYoutube() && count >= 2) {
      console.log("Delaying removing youtube by 4s (expected lag)");
      await new Promise(r => setTimeout(r, 4000));
    }
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
        audio=off
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
    ${self}.novideo {
      height: 16px;
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
    const youtubeId = "UDSAUmxZGjE";

    const {
      clientShowYoutube,
      clientYoutubeSize,
      sakConfig,
      speechFetching,
      speechInWhereby,
      speechScheduled,
      wherebyActiveRoom,
    } = useSel(
      "clientShowYoutube",
      "clientYoutubeSize",
      "sakConfig",
      "speechFetching",
      "speechInWhereby",
      "speechScheduled",
      "wherebyActiveRoom"
    );
    useEffect(() => {
      if (["big", "small"].includes(clientYoutubeSize)) {
        //this.classList.toggle("bigyoutube", clientYoutubeSize === "big" && !wherebyActiveRoom);
      }
      this.classList.toggle("novideo", sakConfig.video === false);
    }, [clientYoutubeSize, wherebyActiveRoom, sakConfig.video]);

    if (sakConfig.video === false) {
      this.html`${null}`;
    }
    else if (speechFetching) {
      this.html`Waiting...`;
    } else {
      this.html`
        ${clientShowYoutube ? html`<roi-youtube .id=${youtubeId} />` : null}
        ${wherebyActiveRoom ? html`<WherebyEmbed .creds=${this.creds} />` : null}
      `;
    }
  },
});
