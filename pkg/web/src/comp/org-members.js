import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";

define("RoiOrgMembers", {
  mappedAttributes: ["org"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      members: [],
      pendingInvites: [],
      error: null,
      success: null,
      // Invite form
      inviteEmail: "",
      inviteRole: "member",
      inviting: false,
      inviteError: null,
      // Remove member
      removing: null,
      showRemoveConfirm: null,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }
  },
  onconnected() {
    if (this.org) {
      this.loadMembers();
    }
  },
  onattributechanged({ attributeName }) {
    if (attributeName === "org" && this.org) {
      this.loadMembers();
    }
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .members-section {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    ${self} h3 {
      margin: 0 0 16px 0;
      color: var(--roi-primary);
      font-size: 18px;
    }
    ${self} .member-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ${self} .member-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    ${self} .member-item:last-child {
      border-bottom: none;
    }
    ${self} .member-info {
      flex: 1;
    }
    ${self} .member-name {
      font-weight: 500;
      color: #333;
    }
    ${self} .member-email {
      font-size: 14px;
      color: #666;
    }
    ${self} .member-role {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      margin-left: 8px;
    }
    ${self} .role-owner {
      background: #dbeafe;
      color: #1d4ed8;
    }
    ${self} .role-admin {
      background: #fef3c7;
      color: #92400e;
    }
    ${self} .role-member {
      background: #f3f4f6;
      color: #4b5563;
    }
    ${self} .member-actions {
      margin-left: 16px;
    }
    ${self} .btn-remove {
      padding: 6px 12px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    ${self} .btn-remove:hover {
      background: #fecaca;
    }
    ${self} .btn-remove:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ${self} .remove-confirm {
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
    ${self} .invite-form {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    ${self} .form-group {
      flex: 1;
      min-width: 200px;
    }
    ${self} label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    ${self} input[type="email"],
    ${self} select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    ${self} input[type="email"]:focus,
    ${self} select:focus {
      border-color: var(--roi-primary);
      outline: none;
    }
    ${self} .btn-invite {
      padding: 10px 20px;
      background: var(--roi-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
    }
    ${self} .btn-invite:hover {
      opacity: 0.9;
    }
    ${self} .btn-invite:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
    ${self} .invite-error {
      color: #dc2626;
      font-size: 13px;
      margin-top: 8px;
    }
    ${self} .empty-list {
      color: #666;
      text-align: center;
      padding: 20px;
    }
    ${self} .pending-invites {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    ${self} .pending-invites h4 {
      margin: 0 0 12px 0;
      color: #666;
      font-size: 14px;
    }
    ${self} .invite-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    ${self} .invite-item:last-child {
      border-bottom: none;
    }
    ${self} .invite-email {
      flex: 1;
      color: #666;
    }
    ${self} .invite-status {
      font-size: 12px;
      color: #9ca3af;
    }
    ${self} .no-permission {
      background: #f9fafb;
      padding: 16px;
      border-radius: 4px;
      color: #6b7280;
      text-align: center;
    }
    `;
  },
  canManage() {
    const role = this.org?.myRole;
    return role === "owner" || role === "admin";
  },
  isOwner() {
    return this.org?.myRole === "owner";
  },
  async loadMembers() {
    if (!this.org) return;

    try {
      const query = `
        query GetOrganizationMembers($orgId: Int!) {
          getOrganizationMembers(orgId: $orgId) {
            nodes {
              memberId
              userId
              email
              name
              role
              joinedAt
            }
          }
        }
      `;

      const result = await gql(query, { orgId: this.org.id }, { jwt: this.creds.jwt });
      this.state.members = result.getOrganizationMembers?.nodes || [];
      this.state.loading = false;

      // If user can manage, also load pending invites
      if (this.canManage()) {
        await this.loadPendingInvites();
      }
    } catch (err) {
      this.state.error = err.message || "Kunne ikkje lasta medlemer";
      this.state.loading = false;
    }
    this.render();
  },
  async loadPendingInvites() {
    try {
      const query = `
        query GetOrganizationInvites($orgId: Int!) {
          organizationInvites(condition: {organizationId: $orgId}) {
            nodes {
              id
              email
              role
              expiresAt
              acceptedAt
            }
          }
        }
      `;

      const result = await gql(query, { orgId: this.org.id }, { jwt: this.creds.jwt });
      // Filter to only pending invites (not accepted)
      this.state.pendingInvites = (result.organizationInvites?.nodes || [])
        .filter(inv => !inv.acceptedAt && new Date(inv.expiresAt) > new Date());
    } catch (err) {
      // Silently ignore invite loading errors - user may not have permission
      console.warn("Could not load invites:", err.message);
    }
  },
  oninput(event) {
    if (event.target.name === "invite-email") {
      this.state.inviteEmail = event.target.value;
    } else if (event.target.name === "invite-role") {
      this.state.inviteRole = event.target.value;
    }
  },
  async onsubmit(event) {
    event.preventDefault();
    if (!this.canManage()) return;

    const email = this.state.inviteEmail.trim();
    const role = this.state.inviteRole;

    if (!email) {
      this.state.inviteError = "E-post er obligatorisk";
      this.render();
      return;
    }

    this.state.inviting = true;
    this.state.inviteError = null;
    this.render();

    try {
      const mutation = `
        mutation InviteToOrganization($orgId: Int!, $email: String!, $role: OrganizationRole!) {
          inviteToOrganization(input: {orgId: $orgId, inviteEmail: $email, inviteRole: $role}) {
            organizationInvite {
              id
              email
              role
              expiresAt
            }
          }
        }
      `;

      await gql(mutation, { orgId: this.org.id, email, role }, { jwt: this.creds.jwt });

      // Clear form and show success
      this.state.inviteEmail = "";
      this.state.inviteRole = "member";
      this.state.inviting = false;
      this.state.success = `Invitasjon sendt til ${email}`;

      // Reload invites
      await this.loadPendingInvites();
      this.render();

      // Clear success after 3 seconds
      setTimeout(() => {
        this.state.success = null;
        this.render();
      }, 3000);
    } catch (err) {
      this.state.inviting = false;
      const messages = err.extra?.body?.errors?.map((e) => e.message) || [
        err.message || "Kunne ikkje senda invitasjon",
      ];
      this.state.inviteError = messages.join(". ");
      this.render();
    }
  },
  onclick(event) {
    const target = event.target;

    if (target.dataset.action === "show-remove") {
      this.state.showRemoveConfirm = parseInt(target.dataset.userId);
      this.render();
    } else if (target.dataset.action === "cancel-remove") {
      this.state.showRemoveConfirm = null;
      this.render();
    } else if (target.dataset.action === "confirm-remove") {
      this.removeMember(parseInt(target.dataset.userId));
    }
  },
  async removeMember(userId) {
    this.state.removing = userId;
    this.state.error = null;
    this.render();

    try {
      const mutation = `
        mutation RemoveOrganizationMember($orgId: Int!, $userId: Int!) {
          removeOrganizationMember(input: {orgId: $orgId, memberUserId: $userId}) {
            boolean
          }
        }
      `;

      await gql(mutation, { orgId: this.org.id, userId }, { jwt: this.creds.jwt });

      // Remove from list
      this.state.members = this.state.members.filter(m => m.userId !== userId);
      this.state.removing = null;
      this.state.showRemoveConfirm = null;
      this.state.success = "Medlem fjerna";
      this.render();

      // Clear success after 3 seconds
      setTimeout(() => {
        this.state.success = null;
        this.render();
      }, 3000);
    } catch (err) {
      this.state.removing = null;
      this.state.showRemoveConfirm = null;
      const messages = err.extra?.body?.errors?.map((e) => e.message) || [
        err.message || "Kunne ikkje fjerna medlemet",
      ];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  canRemoveMember(member) {
    const myRole = this.org?.myRole;
    if (!myRole) return false;

    // Owners can remove anyone except themselves if they're the only owner
    if (myRole === "owner") {
      return true;
    }

    // Admins can only remove regular members
    if (myRole === "admin") {
      return member.role === "member";
    }

    return false;
  },
  getRoleBadge(role) {
    const labels = {
      owner: "Eigar",
      admin: "Admin",
      member: "Medlem",
    };
    return html`<span class=${`member-role role-${role}`}>${labels[role] || role}</span>`;
  },
  render() {
    const { loading, members, pendingInvites, error, success } = this.state;
    const org = this.org;

    if (!org) {
      return this.html`<p>Lastar...</p>`;
    }

    if (loading) {
      return this.html`<p>Lastar medlemer...</p>`;
    }

    const canManage = this.canManage();
    const isOwner = this.isOwner();

    return this.html`
      ${success ? html`<div class="success-msg">${success}</div>` : ""}
      ${error ? html`<div class="error-msg">${error}</div>` : ""}

      <div class="members-section">
        <h3>Medlemer</h3>
        ${members.length === 0
          ? html`<p class="empty-list">Ingen medlemer enno</p>`
          : html`
            <ul class="member-list">
              ${members.map(member => html`
                <li class="member-item">
                  <div class="member-info">
                    <span class="member-name">${member.name}</span>
                    ${this.getRoleBadge(member.role)}
                    <div class="member-email">${member.email}</div>
                  </div>
                  ${canManage && this.canRemoveMember(member) ? html`
                    <div class="member-actions">
                      ${this.state.showRemoveConfirm === member.userId ? html`
                        <div class="remove-confirm">
                          <button
                            class="btn-cancel"
                            data-action="cancel-remove"
                            onclick=${this}
                          >Avbryt</button>
                          <button
                            class="btn-remove"
                            data-action="confirm-remove"
                            data-user-id=${member.userId}
                            onclick=${this}
                            disabled=${this.state.removing === member.userId}
                          >
                            ${this.state.removing === member.userId ? "Fjernar..." : "Stadfest"}
                          </button>
                        </div>
                      ` : html`
                        <button
                          class="btn-remove"
                          data-action="show-remove"
                          data-user-id=${member.userId}
                          onclick=${this}
                        >Fjern</button>
                      `}
                    </div>
                  ` : ""}
                </li>
              `)}
            </ul>
          `}

        ${canManage && pendingInvites.length > 0 ? html`
          <div class="pending-invites">
            <h4>Ventande invitasjonar</h4>
            ${pendingInvites.map(invite => html`
              <div class="invite-item">
                <span class="invite-email">${invite.email}</span>
                ${this.getRoleBadge(invite.role)}
                <span class="invite-status">Utløpar ${new Date(invite.expiresAt).toLocaleDateString("nn-NO")}</span>
              </div>
            `)}
          </div>
        ` : ""}
      </div>

      ${canManage ? html`
        <div class="members-section">
          <h3>Inviter nytt medlem</h3>
          <form class="invite-form" onsubmit=${this} oninput=${this}>
            <div class="form-group">
              <label for="invite-email">E-post</label>
              <input
                type="email"
                id="invite-email"
                name="invite-email"
                value=${this.state.inviteEmail}
                placeholder="namn@eksempel.no"
                required
              />
            </div>
            <div class="form-group" style="flex: 0 0 150px; min-width: 150px;">
              <label for="invite-role">Rolle</label>
              <select id="invite-role" name="invite-role">
                <option value="member" selected=${this.state.inviteRole === "member"}>Medlem</option>
                ${isOwner ? html`
                  <option value="admin" selected=${this.state.inviteRole === "admin"}>Admin</option>
                  <option value="owner" selected=${this.state.inviteRole === "owner"}>Eigar</option>
                ` : ""}
              </select>
            </div>
            <button
              type="submit"
              class="btn-invite"
              disabled=${this.state.inviting}
            >
              ${this.state.inviting ? "Sender..." : "Send invitasjon"}
            </button>
          </form>
          ${this.state.inviteError ? html`<p class="invite-error">${this.state.inviteError}</p>` : ""}
        </div>
      ` : html`
        <div class="members-section">
          <p class="no-permission">
            Du må vera admin eller eigar for å invitera nye medlemer.
          </p>
        </div>
      `}
    `;
  },
});
