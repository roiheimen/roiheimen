import { define, html } from "/web_modules/heresy.js";

define("RoiOrgCard", {
  extends: "div",
  mappedAttributes: ["org"],
  oninit() {
    // org will be set via mapped attribute
  },
  style(self) {
    return `
    ${self} {
      display: block;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      background: #fafafa;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    ${self}:hover {
      border-color: var(--roi-theme-main-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    ${self} .org-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    ${self} h3 {
      margin: 0;
      color: var(--roi-theme-main-color);
      font-size: 18px;
    }
    ${self} .role-badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: lowercase;
    }
    ${self} .role-badge.owner {
      background: #4a90d9;
      color: white;
    }
    ${self} .role-badge.admin {
      background: #7c3aed;
      color: white;
    }
    ${self} .role-badge.member {
      background: #e5e7eb;
      color: #374151;
    }
    ${self} .slug {
      margin: 0;
      color: #666;
      font-size: 14px;
      font-family: monospace;
    }
    ${self} .org-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }
    ${self} .meeting-count {
      font-size: 13px;
      color: #666;
    }
    ${self} .org-link {
      font-size: 14px;
      color: var(--roi-theme-main-color);
      text-decoration: none;
    }
    ${self} .org-link:hover {
      text-decoration: underline;
    }
    `;
  },
  getRoleName(role) {
    const roleNames = {
      owner: "eigar",
      admin: "admin",
      member: "medlem",
    };
    return roleNames[role] || role;
  },
  render() {
    const org = this.org;
    if (!org) {
      return this.html`<p>Lastar...</p>`;
    }

    const role = org.myRole || "member";
    const meetingCount = org.meetings?.totalCount || 0;

    return this.html`
      <div class="org-header">
        <h3>${org.name}</h3>
        <span class=${`role-badge ${role}`}>${this.getRoleName(role)}</span>
      </div>
      <p class="slug">${org.slug}</p>
      <div class="org-footer">
        <span class="meeting-count">
          ${meetingCount === 0
            ? "Ingen møte"
            : meetingCount === 1
            ? "1 møte"
            : `${meetingCount} møte`}
        </span>
        <a href=${`/org-innstillingar.html?slug=${org.slug}`} class="org-link">Opna →</a>
      </div>
    `;
  },
});
