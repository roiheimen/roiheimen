import { define, html, ref } from "/web_modules/heresy.js";

import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";

function genPass() {
  const pass = Math.random().toString(36).slice(2, 12);
  if (pass.length < 10) return genPass();
  return pass;
}

const UserTextArea = {
  mappedAttributes: ["id"],
  style(self) {
    return `
    ${self} textarea { width: 100%; min-height: 20em; }
    `;
  },
  onchange(e) {
    const {
      target: { value },
    } = e;
    const lines = value.split("\n");
    const userList = lines
      .filter((l) => l?.trim())
      .map((l) => l.split(/,\s*/g).map((f) => f.trim()))
      .filter((l) => l.length)
      .map((l) => ({
        num: Number(l[0]),
        name: l[1],
        password: l[2] || genPass(),
        org: l[3] || "",
        email: l[4],
      }));
    this.dispatchEvent(new CustomEvent("users", { detail: userList }));
  },
  render() {
    this.html`
      <textarea
       onchange=${this}
       placeholder="Nummer, Namn, Passord (valfritt), Lag (valfritt), Epost (valfritt)\nNummer2, Namn2"
      />`;
  },
};

const UsersPreview = {
  mappedAttributes: ["users"],
  style(self) {
    return `
    ${self} table { width: 100%; }
    `;
  },
  onusers() {
    this.render();
  },

  render() {
    if (!this.users) return this.html`Legg til deltakarar i tekstboksen`;
    this.html`
    <table>
      <tr><th>Nummer <th>Namn <th>Passord <th>Lag <th>Epost </tr>
      ${this.users.map(
        (user) =>
          html`
            <tr>
              <td>${user.num}</td>
              <td>${user.name}</td>
              <td><code>${user.password}</code></td>
              <td>${user.org}</td>
              <td>${user.email}</td>
            </tr>
          `
      )}
      </table>`;
  },
};

define("RoiAddUsers", {
  mappedAttributes: ["users", "meetingId"],
  includes: { UserTextArea, UsersPreview },
  oninit() {
    this.addEventListener("submit", this);
    this.meetingId = storage("myself").meetingId;
  },
  onusers() {
    this.render();
  },
  onchange({ target: { value } }) {
    this.meetingId = value;
    this.render();
  },
  onclick(e) {
    e.preventDefault();
    console.log("XXX submit", this.users);
    gql(
      `mutation RegisterPeople($meetingId: String!, $people: [PeopleInputRecordInput!]!) {
        registerPeople(
          input: { meetingId: $meetingId, people: $people }
        ) {
          people {
            id
            name
            num
          }
        }
      }`,
      {
        meetingId: this.meetingId,
        people: this.users,
      }
    );
  },
  render({ useSel }) {
    const { myself } = useSel("myself");
    this.meetingId = myself?.meetingId;
    const canSave = this.meetingId && this.users;
    this.html`
      <label>
        Organisasjon
        <input placeholder="skriv_inn" value=${this.meetingId} onchange=${this} />
      </label>
      <UserTextArea onusers=${({ detail }) => {
        this.users = detail;
      }} />
      <UsersPreview users=${this.users} />
      <input onclick=${this} type=submit value="Lagre" disabled=${!canSave} />
    `;
  },
});
