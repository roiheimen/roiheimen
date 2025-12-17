import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";
import "./theme-picker.js";

define("RoiMeetingSettings", {
  mappedAttributes: ["meeting", "organization"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: false,
      saving: false,
      error: null,
      success: null,
      editedTitle: null,
      editedConfig: null,
      showDeleteConfirm: false,
      deleting: false,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .settings-section {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    ${self} h3 {
      margin: 0 0 16px 0;
      color: var(--roi-theme-main-color);
      font-size: 18px;
    }
    ${self} .form-group {
      margin-bottom: 16px;
    }
    ${self} label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
    }
    ${self} input[type="text"],
    ${self} input[type="url"],
    ${self} textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    ${self} input[type="text"]:focus,
    ${self} input[type="url"]:focus,
    ${self} textarea:focus {
      border-color: var(--roi-theme-main-color);
      outline: none;
    }
    ${self} input[type="text"]:disabled,
    ${self} input[type="url"]:disabled,
    ${self} textarea:disabled {
      background: #f5f5f5;
      color: #666;
    }
    ${self} textarea {
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
    }
    ${self} .read-only {
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
      font-family: monospace;
      color: #666;
    }
    ${self} .hint {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }
    ${self} .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    ${self} .checkbox-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 250px;
    }
    ${self} .checkbox-item input[type="checkbox"] {
      margin-top: 3px;
    }
    ${self} .checkbox-item label {
      font-weight: normal;
      margin-bottom: 0;
    }
    ${self} .checkbox-hint {
      font-size: 12px;
      color: #666;
      display: block;
    }
    ${self} .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.2s;
    }
    ${self} .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${self} .btn-primary {
      background: var(--roi-theme-main-color);
      color: white;
    }
    ${self} .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
    }
    ${self} .btn-danger {
      background: #dc2626;
      color: white;
    }
    ${self} .btn-danger:hover:not(:disabled) {
      background: #b91c1c;
    }
    ${self} .btn-cancel {
      background: #e5e7eb;
      color: #374151;
      margin-right: 8px;
    }
    ${self} .success-msg {
      color: #059669;
      margin-bottom: 16px;
      padding: 10px;
      background: #d1fae5;
      border-radius: 4px;
    }
    ${self} .error-msg {
      color: #dc2626;
      margin-bottom: 16px;
      padding: 10px;
      background: #fee2e2;
      border-radius: 4px;
    }
    ${self} .danger-zone {
      border-color: #fecaca;
      background: #fef2f2;
    }
    ${self} .danger-zone h3 {
      color: #dc2626;
    }
    ${self} .danger-zone p {
      color: #7f1d1d;
      margin: 0 0 16px 0;
    }
    ${self} .delete-confirm {
      background: #fee2e2;
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
    ${self} .delete-confirm p {
      margin: 0 0 12px 0;
    }
    ${self} .no-edit {
      background: #f9fafb;
      padding: 16px;
      border-radius: 4px;
      color: #6b7280;
      text-align: center;
    }
    ${self} .links-section {
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
    }
    ${self} .link-item {
      margin-bottom: 12px;
    }
    ${self} .link-item:last-child {
      margin-bottom: 0;
    }
    ${self} .link-item label {
      font-size: 13px;
      color: #1e40af;
    }
    ${self} .link-item a {
      display: block;
      font-family: monospace;
      font-size: 13px;
      color: #2563eb;
      word-break: break-all;
    }
    `;
  },
  canEdit() {
    const role = this.organization?.myRoleInOrganization;
    return role === "owner" || role === "admin";
  },
  isOwner() {
    return this.organization?.myRoleInOrganization === "owner";
  },
  getConfig() {
    if (this.state.editedConfig !== null) {
      return this.state.editedConfig;
    }
    return this.meeting?.config || {};
  },
  async onsubmit(event) {
    event.preventDefault();
    if (!this.canEdit()) return;

    const form = new FormData(event.currentTarget);
    const newTitle = form.get("title")?.trim();

    if (!newTitle) {
      this.state.error = "Tittel er obligatorisk";
      this.render();
      return;
    }

    // Build config from form
    const config = this.getConfig();
    const newConfig = {
      ...config,
      video: form.get("video")?.trim() || false,
      externalCss: form.get("externalCss")?.trim() || undefined,
      speechDisabled: form.get("speechDisabled") === "on",
      speechInnleggDisabled: form.get("speechInnleggDisabled") === "on",
      hideClosedReferendumResults: form.get("hideClosedReferendumResults") === "on",
      gfxIframeOnQueue: form.get("gfxIframeOnQueue") === "on",
      stableChoices: form.get("stableChoices") === "on",
    };

    // Clean up undefined values
    Object.keys(newConfig).forEach(key => {
      if (newConfig[key] === undefined || newConfig[key] === "") {
        delete newConfig[key];
      }
    });

    this.state.saving = true;
    this.state.error = null;
    this.state.success = null;
    this.render();

    const mutation = `
      mutation UpdateOrgMeeting($meetingId: String!, $newTitle: String, $newConfig: JSON) {
        updateOrgMeeting(input: {meetingId: $meetingId, newTitle: $newTitle, newConfig: $newConfig}) {
          meeting {
            id
            title
            config
          }
        }
      }
    `;

    try {
      const result = await gql(
        mutation,
        { meetingId: this.meeting.id, newTitle, newConfig },
        this.creds.jwt
      );
      // Update the meeting data
      Object.assign(this.meeting, result.updateOrgMeeting.meeting);
      this.state.success = "Innstillingane er lagra";
      this.state.editedTitle = null;
      this.state.editedConfig = null;
      this.state.saving = false;
      this.render();
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.state.success = null;
        this.render();
      }, 3000);
    } catch (error) {
      this.state.saving = false;
      const messages =
        error.extra?.body?.errors?.map((e) => e.message) || [
          error.message || "Noko gjekk gale",
        ];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  async handleDelete() {
    if (!this.isOwner()) return;

    this.state.deleting = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation DeleteOrgMeeting($meetingId: String!) {
        deleteOrgMeeting(input: {meetingId: $meetingId}) {
          boolean
        }
      }
    `;

    try {
      await gql(mutation, { meetingId: this.meeting.id }, this.creds.jwt);
      // Redirect to dashboard after deletion
      window.location.href = "/oversikt.html";
    } catch (error) {
      this.state.deleting = false;
      this.state.showDeleteConfirm = false;
      const messages =
        error.extra?.body?.errors?.map((e) => e.message) || [
          error.message || "Kunne ikkje sletta møtet",
        ];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  oninput(event) {
    if (event.target.name === "title") {
      this.state.editedTitle = event.target.value;
    }
  },
  onchange(event) {
    // For checkboxes, update config immediately to track changes
    const target = event.target;
    if (target.type === "checkbox" || target.name === "video" || target.name === "externalCss") {
      const config = { ...this.getConfig() };
      if (target.type === "checkbox") {
        config[target.name] = target.checked;
      } else {
        config[target.name] = target.value?.trim() || undefined;
      }
      this.state.editedConfig = config;
    }
  },
  onclick(event) {
    if (event.target.name === "show-delete") {
      this.state.showDeleteConfirm = true;
      this.render();
    } else if (event.target.name === "cancel-delete") {
      this.state.showDeleteConfirm = false;
      this.render();
    } else if (event.target.name === "confirm-delete") {
      this.handleDelete();
    }
  },
  onThemeChange(event) {
    // Update config with theme data from theme-picker
    const config = { ...this.getConfig() };
    config.theme = event.detail.theme;
    this.state.editedConfig = config;
  },
  render() {
    const meeting = this.meeting;
    const organization = this.organization;

    if (!meeting || !organization) {
      return this.html`<p>Lastar...</p>`;
    }

    const canEdit = this.canEdit();
    const isOwner = this.isOwner();
    const currentTitle =
      this.state.editedTitle !== null ? this.state.editedTitle : meeting.title;
    const config = this.getConfig();

    // Build URLs
    const baseUrl = window.location.origin;
    const meetingUrls = {
      queue: `${baseUrl}/queue.html?id=${meeting.id}`,
      manage: `${baseUrl}/manage.html?id=${meeting.id}`,
      gfx: `${baseUrl}/gfx.html?id=${meeting.id}`,
      screen: `${baseUrl}/screen.html?id=${meeting.id}`,
      fullscreen: `${baseUrl}/fullscreen.html?id=${meeting.id}`,
    };

    return this.html`
      ${this.state.success ? html`<div class="success-msg">${this.state.success}</div>` : ""}
      ${this.state.error ? html`<div class="error-msg">${this.state.error}</div>` : ""}

      <!-- Meeting Links Section -->
      <div class="settings-section links-section">
        <h3>Lenker til møtet</h3>
        <div class="link-item">
          <label>Deltakarside (queue)</label>
          <a href=${meetingUrls.queue} target="_blank">${meetingUrls.queue}</a>
        </div>
        <div class="link-item">
          <label>Administrasjon</label>
          <a href=${meetingUrls.manage} target="_blank">${meetingUrls.manage}</a>
        </div>
        <div class="link-item">
          <label>OBS-grafikk (gfx)</label>
          <a href=${meetingUrls.gfx} target="_blank">${meetingUrls.gfx}</a>
        </div>
        <div class="link-item">
          <label>Fullskjerm for publikum</label>
          <a href=${meetingUrls.fullscreen} target="_blank">${meetingUrls.fullscreen}</a>
        </div>
        <div class="link-item">
          <label>Skjerm (fleire funksjonar)</label>
          <a href=${meetingUrls.screen} target="_blank">${meetingUrls.screen}</a>
        </div>
      </div>

      <div class="settings-section">
        <h3>Generelt</h3>
        ${
          canEdit
            ? html`
                <form onsubmit=${this} oninput=${this} onchange=${this}>
                  <div class="form-group">
                    <label for="title">Tittel</label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value=${currentTitle}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Møte-ID</label>
                    <div class="read-only">${meeting.id}</div>
                    <p class="hint">Møte-ID kan ikkje endrast</p>
                  </div>

                  <div class="form-group">
                    <label>Organisasjon</label>
                    <div class="read-only">${organization.name} (${organization.slug})</div>
                  </div>

                  <h3 style="margin-top: 24px;">Taleliste</h3>

                  <div class="checkbox-group">
                    <div class="checkbox-item">
                      <input
                        type="checkbox"
                        id="speechDisabled"
                        name="speechDisabled"
                        checked=${config.speechDisabled === true}
                      />
                      <label for="speechDisabled">
                        Steng talelista
                        <span class="checkbox-hint">Ingen kan melde seg på talelista</span>
                      </label>
                    </div>

                    <div class="checkbox-item">
                      <input
                        type="checkbox"
                        id="speechInnleggDisabled"
                        name="speechInnleggDisabled"
                        checked=${config.speechInnleggDisabled === true}
                      />
                      <label for="speechInnleggDisabled">
                        Steng berre innlegg
                        <span class="checkbox-hint">Berre replikkar og saksopplysingar er opne</span>
                      </label>
                    </div>
                  </div>

                  <h3 style="margin-top: 24px;">Avrøysting</h3>

                  <div class="checkbox-group">
                    <div class="checkbox-item">
                      <input
                        type="checkbox"
                        id="hideClosedReferendumResults"
                        name="hideClosedReferendumResults"
                        checked=${config.hideClosedReferendumResults === true}
                      />
                      <label for="hideClosedReferendumResults">
                        Gøym resultat av lukka avrøystingar
                        <span class="checkbox-hint">Deltakarar ser ikkje resultatet før du viser det</span>
                      </label>
                    </div>

                    <div class="checkbox-item">
                      <input
                        type="checkbox"
                        id="gfxIframeOnQueue"
                        name="gfxIframeOnQueue"
                        checked=${config.gfxIframeOnQueue === true}
                      />
                      <label for="gfxIframeOnQueue">
                        Vis live grafikk til deltakarar
                        <span class="checkbox-hint">Kan vera tungt for server og nettverk</span>
                      </label>
                    </div>

                    <div class="checkbox-item">
                      <input
                        type="checkbox"
                        id="stableChoices"
                        name="stableChoices"
                        checked=${config.stableChoices === true}
                      />
                      <label for="stableChoices">
                        Stabile røysteval
                        <span class="checkbox-hint">Ikkje tilfeldig rekkjefølgje på vala</span>
                      </label>
                    </div>
                  </div>

                  <h3 style="margin-top: 24px;">Video og utsjånad</h3>

                  <div class="form-group">
                    <label for="video">YouTube Video-ID</label>
                    <input
                      type="text"
                      id="video"
                      name="video"
                      value=${config.video || ""}
                      placeholder="t.d. dQw4w9WgXcQ"
                    />
                    <p class="hint">ID-en frå YouTube-lenka (den delen etter v=)</p>
                  </div>

                  <div class="form-group">
                    <label for="externalCss">Ekstern CSS-fil</label>
                    <input
                      type="url"
                      id="externalCss"
                      name="externalCss"
                      value=${config.externalCss || ""}
                      placeholder="https://example.com/style.css"
                    />
                    <p class="hint">URL til ei CSS-fil for tilpassa utsjånad</p>
                  </div>

                  <div class="form-group" style="margin-top: 24px;">
                    <roi-theme-picker
                      .config=${config}
                      ontheme-change=${(e) => this.onThemeChange(e)}
                    ></roi-theme-picker>
                  </div>

                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled=${this.state.saving}
                    style="margin-top: 16px;"
                  >
                    ${this.state.saving ? "Lagrar..." : "Lagra endringar"}
                  </button>
                </form>
              `
            : html`
                <div class="no-edit">
                  <p>
                    Du må vera admin eller eigar for å endra innstillingane.
                  </p>
                </div>
                <div class="form-group">
                  <label>Tittel</label>
                  <div class="read-only">${meeting.title}</div>
                </div>
                <div class="form-group">
                  <label>Møte-ID</label>
                  <div class="read-only">${meeting.id}</div>
                </div>
                <div class="form-group">
                  <label>Organisasjon</label>
                  <div class="read-only">${organization.name}</div>
                </div>
              `
        }
      </div>

      ${
        isOwner
          ? html`
              <div class="settings-section danger-zone">
                <h3>Faresone</h3>
                <p>
                  Sletting av møtet er permanent og kan ikkje angrast.
                  Alle saker, talelister og avrøystingar vert sletta.
                </p>
                ${
                  this.state.showDeleteConfirm
                    ? html`
                        <div class="delete-confirm">
                          <p>
                            <strong
                              >Er du sikker på at du vil sletta "${meeting.title}"?</strong
                            >
                          </p>
                          <button
                            name="cancel-delete"
                            class="btn btn-cancel"
                            onclick=${this}
                            disabled=${this.state.deleting}
                          >
                            Avbryt
                          </button>
                          <button
                            name="confirm-delete"
                            class="btn btn-danger"
                            onclick=${this}
                            disabled=${this.state.deleting}
                          >
                            ${this.state.deleting
                              ? "Slettar..."
                              : "Ja, slett møtet"}
                          </button>
                        </div>
                      `
                    : html`
                        <button
                          name="show-delete"
                          class="btn btn-danger"
                          onclick=${this}
                        >
                          Slett møtet
                        </button>
                      `
                }
              </div>
            `
          : ""
      }
    `;
  },
});
