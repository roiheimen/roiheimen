import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";

define("RoiOrgSettings", {
  mappedAttributes: ["org"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: false,
      saving: false,
      error: null,
      success: null,
      editedName: null,
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
    ${self} input[type="text"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    ${self} input[type="text"]:focus {
      border-color: var(--roi-theme-main-color);
      outline: none;
    }
    ${self} input[type="text"]:disabled {
      background: #f5f5f5;
      color: #666;
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
    `;
  },
  canEdit() {
    const role = this.org?.myRole;
    return role === "owner" || role === "admin";
  },
  isOwner() {
    return this.org?.myRole === "owner";
  },
  async onsubmit(event) {
    event.preventDefault();
    if (!this.canEdit()) return;

    const form = new FormData(event.currentTarget);
    const newName = form.get("name")?.trim();

    if (!newName) {
      this.state.error = "Namn er obligatorisk";
      this.render();
      return;
    }

    this.state.saving = true;
    this.state.error = null;
    this.state.success = null;
    this.render();

    const mutation = `
      mutation UpdateOrganization($orgId: Int!, $newName: String, $newConfig: JSON) {
        updateOrganization(input: {orgId: $orgId, newName: $newName, newConfig: $newConfig}) {
          organization {
            id
            slug
            name
            config
            myRole
          }
        }
      }
    `;

    try {
      const result = await gql(
        mutation,
        { orgId: this.org.id, newName, newConfig: null },
        { jwt: this.creds.jwt }
      );
      // Update the org data
      Object.assign(this.org, result.updateOrganization.organization);
      this.state.success = "Innstillingane er lagra";
      this.state.editedName = null;
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
      mutation DeleteOrganization($orgId: Int!) {
        deleteOrganization(input: {orgId: $orgId}) {
          boolean
        }
      }
    `;

    try {
      await gql(mutation, { orgId: this.org.id }, { jwt: this.creds.jwt });
      // Redirect to dashboard after deletion
      window.location.href = "/oversikt.html";
    } catch (error) {
      this.state.deleting = false;
      this.state.showDeleteConfirm = false;
      const messages =
        error.extra?.body?.errors?.map((e) => e.message) || [
          error.message || "Kunne ikkje sletta organisasjonen",
        ];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  oninput(event) {
    if (event.target.name === "name") {
      this.state.editedName = event.target.value;
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
  render() {
    const org = this.org;
    if (!org) {
      return this.html`<p>Lastar...</p>`;
    }

    const canEdit = this.canEdit();
    const isOwner = this.isOwner();
    const currentName =
      this.state.editedName !== null ? this.state.editedName : org.name;

    return this.html`
      ${this.state.success ? html`<div class="success-msg">${this.state.success}</div>` : ""}
      ${this.state.error ? html`<div class="error-msg">${this.state.error}</div>` : ""}

      <div class="settings-section">
        <h3>Generelt</h3>
        ${
          canEdit
            ? html`
                <form onsubmit=${this} oninput=${this}>
                  <div class="form-group">
                    <label for="name">Namn</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value=${currentName}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Kortnavn (slug)</label>
                    <div class="read-only">${org.slug}</div>
                    <p class="hint">Kortnamnet kan ikkje endrast</p>
                  </div>

                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled=${this.state.saving}
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
                  <label>Namn</label>
                  <div class="read-only">${org.name}</div>
                </div>
                <div class="form-group">
                  <label>Kortnavn (slug)</label>
                  <div class="read-only">${org.slug}</div>
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
                  Sletting av organisasjonen er permanent og kan ikkje angrast.
                  Alle møte og data vert sletta.
                </p>
                ${
                  this.state.showDeleteConfirm
                    ? html`
                        <div class="delete-confirm">
                          <p>
                            <strong
                              >Er du sikker på at du vil sletta "${org.name}"?</strong
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
                              : "Ja, slett organisasjonen"}
                          </button>
                        </div>
                      `
                    : html`
                        <button
                          name="show-delete"
                          class="btn btn-danger"
                          onclick=${this}
                        >
                          Slett organisasjonen
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
