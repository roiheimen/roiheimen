import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";

define("RoiInviteGenerator", {
  mappedAttributes: ["meeting-id"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      maxUses: "",
      expiresAt: "",
      creating: false,
      error: null,
      createdInvite: null,
      showForm: true,
    };
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .generator-section {
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
    ${self} .form-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    ${self} .form-group {
      flex: 1;
      min-width: 150px;
    }
    ${self} label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    ${self} .help-text {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    ${self} input[type="number"],
    ${self} input[type="datetime-local"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    ${self} input:focus {
      border-color: var(--roi-theme-main-color, #2b2c3a);
      outline: none;
    }
    ${self} .btn-create {
      padding: 12px 24px;
      background: var(--roi-theme-main-color, #2b2c3a);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    ${self} .btn-create:hover {
      opacity: 0.9;
    }
    ${self} .btn-create:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${self} .error-msg {
      color: #dc2626;
      padding: 12px;
      background: #fee2e2;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    ${self} .success-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
    }
    ${self} .success-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    ${self} .invite-code {
      font-family: monospace;
      font-size: 32px;
      font-weight: bold;
      color: var(--roi-theme-main-color, #2b2c3a);
      letter-spacing: 4px;
      background: #fff;
      padding: 16px 32px;
      border-radius: 8px;
      border: 2px dashed #ccc;
      display: inline-block;
      margin: 16px 0;
      user-select: all;
    }
    ${self} .invite-link {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
      word-break: break-all;
    }
    ${self} .invite-link a {
      color: var(--roi-theme-main-color, #2b2c3a);
      text-decoration: none;
    }
    ${self} .invite-link a:hover {
      text-decoration: underline;
    }
    ${self} .invite-meta {
      font-size: 13px;
      color: #666;
      margin-top: 12px;
    }
    ${self} .copy-btn {
      padding: 8px 16px;
      background: #e5e7eb;
      color: #374151;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin: 4px;
    }
    ${self} .copy-btn:hover {
      background: #d1d5db;
    }
    ${self} .copy-btn.copied {
      background: #d1fae5;
      color: #059669;
    }
    ${self} .btn-new {
      padding: 10px 20px;
      background: var(--roi-theme-main-color, #2b2c3a);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 16px;
    }
    ${self} .btn-new:hover {
      opacity: 0.9;
    }
    `;
  },
  oninput(event) {
    const { name, value } = event.target;
    if (name === "max-uses") {
      this.state.maxUses = value;
    } else if (name === "expires-at") {
      this.state.expiresAt = value;
    }
  },
  async onsubmit(event) {
    event.preventDefault();

    if (!this["meeting-id"]) {
      this.state.error = "Mangler mote-ID";
      this.render();
      return;
    }

    this.state.creating = true;
    this.state.error = null;
    this.render();

    try {
      const maxUses = this.state.maxUses ? parseInt(this.state.maxUses) : null;
      const expiresAt = this.state.expiresAt ? new Date(this.state.expiresAt).toISOString() : null;

      const mutation = `
        mutation CreateInviteCode($meetingId: String!, $maxUses: Int, $expiresAt: Datetime) {
          createInviteCode(input: {pMeetingId: $meetingId, pMaxUses: $maxUses, pExpiresAt: $expiresAt}) {
            meetingInvite {
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

      const result = await gql(
        mutation,
        { meetingId: this["meeting-id"], maxUses, expiresAt },
        this.creds.jwt
      );

      this.state.createdInvite = result.createInviteCode.meetingInvite;
      this.state.creating = false;
      this.state.showForm = false;
      this.render();

      // Dispatch event for parent components to refresh lists
      this.dispatchEvent(new CustomEvent("invite-created", {
        bubbles: true,
        detail: this.state.createdInvite,
      }));
    } catch (err) {
      this.state.creating = false;
      const messages = err.extra?.body?.errors?.map((e) => e.message) || [
        err.message || "Kunne ikkje laga invitasjonskode",
      ];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  onclick(event) {
    const { action } = event.target.dataset;

    if (action === "copy-code") {
      this.copyToClipboard(this.state.createdInvite.code, event.target);
    } else if (action === "copy-link") {
      const link = this.getInviteLink();
      this.copyToClipboard(link, event.target);
    } else if (action === "new-invite") {
      this.state.showForm = true;
      this.state.createdInvite = null;
      this.state.maxUses = "";
      this.state.expiresAt = "";
      this.render();
    }
  },
  getInviteLink() {
    const code = this.state.createdInvite?.code;
    if (!code) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/i/${code}`;
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
  formatDate(isoString) {
    if (!isoString) return "Ingen";
    return new Date(isoString).toLocaleString("nn-NO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  },
  render() {
    const { showForm, creating, error, createdInvite } = this.state;

    if (!showForm && createdInvite) {
      const inviteLink = this.getInviteLink();
      return this.html`
        <div class="generator-section">
          <div class="success-card">
            <div class="success-icon">✓</div>
            <h3>Invitasjonskode laga!</h3>
            <div class="invite-code">${createdInvite.code}</div>
            <div class="invite-link">
              Direkte lenke: <a href=${inviteLink} target="_blank">${inviteLink}</a>
            </div>
            <div>
              <button class="copy-btn" data-action="copy-code" onclick=${this}>
                Kopier kode
              </button>
              <button class="copy-btn" data-action="copy-link" onclick=${this}>
                Kopier lenke
              </button>
            </div>
            <div class="invite-meta">
              ${createdInvite.maxUses
                ? html`<span>Maks ${createdInvite.maxUses} bruk</span>`
                : html`<span>Ubegrensa bruk</span>`}
              ${createdInvite.expiresAt
                ? html` · <span>Utlopar ${this.formatDate(createdInvite.expiresAt)}</span>`
                : html` · <span>Ingen utlopsdato</span>`}
            </div>
            <button class="btn-new" data-action="new-invite" onclick=${this}>
              Lag ny invitasjonskode
            </button>
          </div>
        </div>
      `;
    }

    return this.html`
      <div class="generator-section">
        <h3>Lag ny invitasjonskode</h3>

        ${error ? html`<div class="error-msg">${error}</div>` : ""}

        <form onsubmit=${this} oninput=${this}>
          <div class="form-row">
            <div class="form-group">
              <label for="max-uses">Maks antal bruk</label>
              <input
                type="number"
                id="max-uses"
                name="max-uses"
                min="1"
                value=${this.state.maxUses}
                placeholder="Ubegrensa"
              />
              <div class="help-text">La stå tom for ubegrensa bruk</div>
            </div>
            <div class="form-group">
              <label for="expires-at">Utlopsdato</label>
              <input
                type="datetime-local"
                id="expires-at"
                name="expires-at"
                value=${this.state.expiresAt}
              />
              <div class="help-text">La stå tom for ingen utlopsdato</div>
            </div>
          </div>

          <button type="submit" class="btn-create" disabled=${creating}>
            ${creating ? "Lagar kode..." : "Lag invitasjonskode"}
          </button>
        </form>
      </div>
    `;
  },
});
