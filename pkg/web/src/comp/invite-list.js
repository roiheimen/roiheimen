import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";

define("RoiInviteList", {
  mappedAttributes: ["meeting-id"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      invites: [],
      error: null,
      deleting: null,
      showDeleteConfirm: null,
      copiedCode: null,
    };
  },
  onconnected() {
    if (this["meeting-id"]) {
      this.loadInvites();
    }

    // Listen for new invite created events
    this.handleInviteCreated = (e) => {
      this.loadInvites();
    };
    document.addEventListener("invite-created", this.handleInviteCreated);
  },
  ondisconnected() {
    document.removeEventListener("invite-created", this.handleInviteCreated);
  },
  onattributechanged({ attributeName }) {
    if (attributeName === "meeting-id" && this["meeting-id"]) {
      this.loadInvites();
    }
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .invites-section {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
    }
    ${self} h3 {
      margin: 0 0 16px 0;
      color: var(--roi-theme-main-color, #2b2c3a);
      font-size: 18px;
    }
    ${self} .invite-table {
      width: 100%;
      border-collapse: collapse;
    }
    ${self} .invite-table th {
      text-align: left;
      padding: 12px 8px;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 600;
      color: #374151;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    ${self} .invite-table td {
      padding: 12px 8px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }
    ${self} .invite-table tr:hover {
      background: #f9fafb;
    }
    ${self} .invite-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--roi-theme-main-color, #2b2c3a);
      letter-spacing: 1px;
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
    }
    ${self} .code-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ${self} .copy-btn {
      padding: 4px 8px;
      background: #e5e7eb;
      color: #374151;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    ${self} .copy-btn:hover {
      background: #d1d5db;
    }
    ${self} .copy-btn.copied {
      background: #d1fae5;
      color: #059669;
    }
    ${self} .usage-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    ${self} .usage-available {
      background: #dbeafe;
      color: #1d4ed8;
    }
    ${self} .usage-limited {
      background: #fef3c7;
      color: #92400e;
    }
    ${self} .usage-exhausted {
      background: #fee2e2;
      color: #dc2626;
    }
    ${self} .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    ${self} .status-active {
      background: #d1fae5;
      color: #059669;
    }
    ${self} .status-expired {
      background: #fee2e2;
      color: #dc2626;
    }
    ${self} .status-exhausted {
      background: #fef3c7;
      color: #92400e;
    }
    ${self} .btn-delete {
      padding: 6px 12px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    ${self} .btn-delete:hover {
      background: #fecaca;
    }
    ${self} .btn-delete:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ${self} .delete-confirm {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    ${self} .btn-cancel {
      padding: 6px 12px;
      background: #e5e7eb;
      color: #374151;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    ${self} .empty-list {
      color: #666;
      text-align: center;
      padding: 40px 20px;
    }
    ${self} .empty-list p {
      margin: 0;
    }
    ${self} .error-msg {
      color: #dc2626;
      padding: 12px;
      background: #fee2e2;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    ${self} .loading {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }
    ${self} .expiry-text {
      font-size: 13px;
      color: #666;
    }
    ${self} .expiry-text.expired {
      color: #dc2626;
    }
    `;
  },
  async loadInvites() {
    if (!this["meeting-id"]) return;

    this.state.loading = true;
    this.render();

    try {
      const query = `
        query GetMeetingInvites($meetingId: String!) {
          getMeetingInvites(pMeetingId: $meetingId) {
            nodes {
              id
              code
              maxUses
              usesCount
              expiresAt
              createdAt
            }
          }
        }
      `;

      const result = await gql(query, { meetingId: this["meeting-id"] }, this.creds.jwt);
      this.state.invites = result.getMeetingInvites?.nodes || [];
      this.state.loading = false;
      this.state.error = null;
    } catch (err) {
      this.state.loading = false;
      this.state.error = err.message || "Kunne ikkje lasta invitasjonskoder";
    }
    this.render();
  },
  onclick(event) {
    const { action, inviteId, code } = event.target.dataset;

    if (action === "copy") {
      this.copyToClipboard(code, event.target);
    } else if (action === "copy-link") {
      const link = `${window.location.origin}/i/${code}`;
      this.copyToClipboard(link, event.target);
    } else if (action === "show-delete") {
      this.state.showDeleteConfirm = parseInt(inviteId);
      this.render();
    } else if (action === "cancel-delete") {
      this.state.showDeleteConfirm = null;
      this.render();
    } else if (action === "confirm-delete") {
      this.deleteInvite(parseInt(inviteId));
    }
  },
  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add("copied");
      const originalText = button.textContent;
      button.textContent = "Kopiert!";
      setTimeout(() => {
        button.classList.remove("copied");
        button.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  },
  async deleteInvite(inviteId) {
    this.state.deleting = inviteId;
    this.state.error = null;
    this.render();

    try {
      const mutation = `
        mutation DeleteInviteCode($inviteId: Int!) {
          deleteInviteCode(input: {pInviteId: $inviteId}) {
            boolean
          }
        }
      `;

      await gql(mutation, { inviteId }, this.creds.jwt);

      // Remove from list
      this.state.invites = this.state.invites.filter((i) => i.id !== inviteId);
      this.state.deleting = null;
      this.state.showDeleteConfirm = null;
    } catch (err) {
      this.state.deleting = null;
      this.state.showDeleteConfirm = null;
      this.state.error = err.message || "Kunne ikkje sletta invitasjonskode";
    }
    this.render();
  },
  isExpired(expiresAt) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  },
  isExhausted(invite) {
    if (!invite.maxUses) return false;
    return invite.usesCount >= invite.maxUses;
  },
  getStatus(invite) {
    if (this.isExpired(invite.expiresAt)) {
      return { class: "status-expired", label: "Utlopt" };
    }
    if (this.isExhausted(invite)) {
      return { class: "status-exhausted", label: "Oppbrukt" };
    }
    return { class: "status-active", label: "Aktiv" };
  },
  getUsageBadge(invite) {
    const { usesCount, maxUses } = invite;
    if (!maxUses) {
      return html`<span class="usage-badge usage-available">${usesCount} brukt · Ubegrensa</span>`;
    }
    const remaining = maxUses - usesCount;
    if (remaining <= 0) {
      return html`<span class="usage-badge usage-exhausted">${usesCount}/${maxUses} brukt</span>`;
    }
    if (remaining <= 5) {
      return html`<span class="usage-badge usage-limited">${usesCount}/${maxUses} brukt</span>`;
    }
    return html`<span class="usage-badge usage-available">${usesCount}/${maxUses} brukt</span>`;
  },
  formatDate(isoString) {
    if (!isoString) return "Aldri";
    const date = new Date(isoString);
    return date.toLocaleDateString("nn-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },
  render() {
    const { loading, invites, error } = this.state;

    if (loading) {
      return this.html`<div class="invites-section"><div class="loading">Lastar invitasjonskoder...</div></div>`;
    }

    return this.html`
      <div class="invites-section">
        <h3>Invitasjonskoder</h3>

        ${error ? html`<div class="error-msg">${error}</div>` : ""}

        ${invites.length === 0
          ? html`
            <div class="empty-list">
              <p>Ingen invitasjonskoder enno. Lag ein ovanfor for a dela med deltakarar.</p>
            </div>
          `
          : html`
            <table class="invite-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Status</th>
                  <th>Bruk</th>
                  <th>Utlopar</th>
                  <th>Laga</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${invites.map((invite) => {
                  const status = this.getStatus(invite);
                  const isExpired = this.isExpired(invite.expiresAt);
                  return html`
                    <tr>
                      <td>
                        <div class="code-cell">
                          <span class="invite-code">${invite.code}</span>
                          <button
                            class="copy-btn"
                            data-action="copy"
                            data-code=${invite.code}
                            onclick=${this}
                            title="Kopier kode"
                          >Kopier</button>
                          <button
                            class="copy-btn"
                            data-action="copy-link"
                            data-code=${invite.code}
                            onclick=${this}
                            title="Kopier lenke"
                          >Lenke</button>
                        </div>
                      </td>
                      <td>
                        <span class=${`status-badge ${status.class}`}>${status.label}</span>
                      </td>
                      <td>
                        ${this.getUsageBadge(invite)}
                      </td>
                      <td>
                        <span class=${`expiry-text ${isExpired ? "expired" : ""}`}>
                          ${invite.expiresAt ? this.formatDate(invite.expiresAt) : "Ingen"}
                        </span>
                      </td>
                      <td>
                        ${this.formatDate(invite.createdAt)}
                      </td>
                      <td>
                        ${this.state.showDeleteConfirm === invite.id
                          ? html`
                            <div class="delete-confirm">
                              <button
                                class="btn-cancel"
                                data-action="cancel-delete"
                                onclick=${this}
                              >Avbryt</button>
                              <button
                                class="btn-delete"
                                data-action="confirm-delete"
                                data-invite-id=${invite.id}
                                onclick=${this}
                                disabled=${this.state.deleting === invite.id}
                              >
                                ${this.state.deleting === invite.id ? "Slettar..." : "Slett"}
                              </button>
                            </div>
                          `
                          : html`
                            <button
                              class="btn-delete"
                              data-action="show-delete"
                              data-invite-id=${invite.id}
                              onclick=${this}
                            >Slett</button>
                          `}
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          `}
      </div>
    `;
  },
});
