import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";

const gqlGetParticipants = `
  mutation GetMeetingParticipants($meetingId: String!) {
    getMeetingParticipants(pMeetingId: $meetingId) {
      nodes {
        id
        meetingId
        userId
        displayName
        participantNum
        isOrganizer
        createdAt
        personId
      }
    }
  }`;

export default define("RoiParticipantList", {
  mappedAttributes: ["meeting-id"],
  oninit() {
    this.participants = [];
    this.loading = false;
    this.error = null;
  },
  "onmeeting-id"() {
    this.fetchParticipants();
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    ${self} .error {
      color: #c00;
      padding: 10px;
      background: #fee;
      border-radius: 4px;
    }
    ${self} table {
      width: 100%;
      border-collapse: collapse;
    }
    ${self} th {
      text-align: left;
      padding: 8px;
      border-bottom: 2px solid #ddd;
      background: #f8f8f8;
    }
    ${self} td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    ${self} tr:hover {
      background: #f5f5f5;
    }
    ${self} .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    ${self} .badge-organizer {
      background: var(--roi-primary);
      color: var(--roi-text-inverse);
    }
    ${self} .badge-participant {
      background: #ddd;
      color: #333;
    }
    ${self} .empty {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    ${self} .num {
      font-weight: bold;
      color: #666;
    }
    ${self} .date {
      font-size: 12px;
      color: #999;
    }
    `;
  },
  async fetchParticipants() {
    const meetingId = this["meeting-id"];
    if (!meetingId) return;

    this.loading = true;
    this.error = null;
    this.render();

    try {
      const res = await gql(gqlGetParticipants, { meetingId });
      this.participants = res.getMeetingParticipants?.nodes || [];
      this.loading = false;
      this.render();
    } catch (e) {
      console.error("Failed to fetch participants:", e);
      this.error = e.message || "Klarte ikkje henta deltakarar";
      this.loading = false;
      this.render();
    }
  },
  render() {
    const meetingId = this["meeting-id"];

    if (!meetingId) {
      this.html`<div class="error">Ingen møte-ID spesifisert</div>`;
      return;
    }

    if (this.loading) {
      this.html`<div class="loading">Lastar deltakarane...</div>`;
      return;
    }

    if (this.error) {
      this.html`
        <div class="error">${this.error}</div>
        <button onclick=${() => this.fetchParticipants()}>Prøv igjen</button>
      `;
      return;
    }

    if (!this.participants.length) {
      this.html`
        <div class="empty">
          <p>Ingen deltakarar har blitt med i møtet enno.</p>
          <p>Del ein invitasjonskode for at folk kan bli med.</p>
        </div>
      `;
      return;
    }

    // Sort by participant number
    const sorted = [...this.participants].sort((a, b) => a.participantNum - b.participantNum);

    this.html`
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Namn</th>
            <th>Rolle</th>
            <th>Blei med</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(p => html`
            <tr>
              <td class="num">${p.participantNum}</td>
              <td>${p.displayName}</td>
              <td>
                ${p.isOrganizer
                  ? html`<span class="badge badge-organizer">Arrangor</span>`
                  : html`<span class="badge badge-participant">Deltakar</span>`
                }
              </td>
              <td class="date">${new Date(p.createdAt).toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}</td>
            </tr>
          `)}
        </tbody>
      </table>
      <p style="margin-top: 10px; color: #666; font-size: 12px;">
        Totalt ${this.participants.length} deltakar${this.participants.length !== 1 ? 'ar' : ''}
      </p>
    `;
  },
});
