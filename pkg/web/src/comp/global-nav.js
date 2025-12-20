import { define, html } from "/web_modules/heresy.js";

import storage, { save } from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

/**
 * Global Navigation Component
 *
 * Provides consistent navigation across pages:
 * - Logo/brand link to home
 * - Organization switcher (if logged in with organizations)
 * - User menu (Profil, Logg ut)
 *
 * Usage:
 * <roi-global-nav></roi-global-nav>
 */
define("RoiGlobalNav", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      user: null,
      organizations: [],
      showOrgDropdown: false,
      showUserDropdown: false,
    };
    this.loadData();

    // Close dropdowns when clicking outside
    this.handleClickOutside = this.handleClickOutside.bind(this);
  },
  onconnected() {
    document.addEventListener("click", this.handleClickOutside);
  },
  ondisconnected() {
    document.removeEventListener("click", this.handleClickOutside);
  },
  handleClickOutside(event) {
    if (!this.contains(event.target)) {
      if (this.state.showOrgDropdown || this.state.showUserDropdown) {
        this.state.showOrgDropdown = false;
        this.state.showUserDropdown = false;
        this.render();
      }
    }
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--roi-primary);
      color: white;
    }
    ${self} .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ${self} .nav-brand a {
      color: white;
      text-decoration: none;
      font-size: 18px;
      font-weight: bold;
    }
    ${self} .nav-brand a:hover {
      opacity: 0.9;
    }
    ${self} .nav-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    ${self} .dropdown {
      position: relative;
    }
    ${self} .dropdown-toggle {
      background: transparent;
      border: none;
      color: white;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-radius: 4px;
    }
    ${self} .dropdown-toggle:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    ${self} .dropdown-toggle svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }
    ${self} .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 180px;
      z-index: 1000;
      padding: 8px 0;
      margin-top: 4px;
    }
    ${self} .dropdown-menu.left {
      right: auto;
      left: 0;
    }
    ${self} .dropdown-item {
      display: block;
      width: 100%;
      padding: 10px 16px;
      color: #333;
      text-decoration: none;
      font-size: 14px;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      box-sizing: border-box;
    }
    ${self} .dropdown-item:hover {
      background: #f5f5f5;
    }
    ${self} .dropdown-item.active {
      background: #e8f0fe;
      color: var(--roi-primary);
      font-weight: 500;
    }
    ${self} .dropdown-divider {
      height: 1px;
      background: #eee;
      margin: 8px 0;
    }
    ${self} .dropdown-header {
      padding: 8px 16px 4px;
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    ${self} .user-email {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-left: 4px;
    }
    ${self} .login-link {
      color: white;
      text-decoration: none;
      padding: 8px 16px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      font-size: 14px;
    }
    ${self} .login-link:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255,255,255,0.5);
    }
    ${self} .org-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      margin-left: 8px;
      text-transform: uppercase;
    }
    ${self} .org-badge.owner {
      background: #e3f2fd;
      color: #1976d2;
    }
    ${self} .org-badge.admin {
      background: #fce4ec;
      color: #c2185b;
    }
    ${self} .org-badge.member {
      background: #f5f5f5;
      color: #666;
    }
    `;
  },
  async loadData() {
    if (!this.creds.jwt) {
      this.state.loading = false;
      this.render();
      return;
    }

    try {
      const query = `
        query NavData {
          currentUserAccount {
            id
            email
            name
          }
          myOrganizations {
            nodes {
              id
              slug
              name
              myRole
            }
          }
        }
      `;

      const result = await gql(query, {}, { jwt: this.creds.jwt });
      this.state.user = result.currentUserAccount;
      this.state.organizations = result.myOrganizations?.nodes || [];
      this.state.loading = false;
    } catch (err) {
      this.state.loading = false;
      // If JWT is invalid, clear it
      if (err.message?.includes("jwt")) {
        Object.keys(this.creds).forEach((k) => delete this.creds[k]);
        save("creds");
      }
    }
    this.render();
  },
  toggleOrgDropdown(event) {
    event.stopPropagation();
    this.state.showOrgDropdown = !this.state.showOrgDropdown;
    this.state.showUserDropdown = false;
    this.render();
  },
  toggleUserDropdown(event) {
    event.stopPropagation();
    this.state.showUserDropdown = !this.state.showUserDropdown;
    this.state.showOrgDropdown = false;
    this.render();
  },
  handleLogout(event) {
    event.preventDefault();
    Object.keys(this.creds).forEach((k) => delete this.creds[k]);
    save("creds");
    window.location.href = "/login.html";
  },
  render() {
    const { loading, user, organizations, showOrgDropdown, showUserDropdown } = this.state;

    // Chevron down SVG
    const chevronDown = html`
      <svg viewBox="0 0 24 24">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
      </svg>
    `;

    // Role badge helper
    const roleBadge = (role) => {
      const labels = {
        owner: "Eigar",
        admin: "Admin",
        member: "Medlem",
      };
      return html`<span class="org-badge ${role}">${labels[role] || role}</span>`;
    };

    // Get current org from URL if on an org-related page
    const currentOrgSlug = new URLSearchParams(window.location.search).get("slug") ||
                          new URLSearchParams(window.location.search).get("org");
    const currentOrg = organizations.find(o => o.slug === currentOrgSlug);

    return this.html`
      <nav>
        <div class="nav-brand">
          <a href=${user ? "/oversikt.html" : "/"}>Roiheimen</a>
        </div>

        <div class="nav-right">
          ${loading ? "" : user ? html`
            <!-- Organization Switcher -->
            ${organizations.length > 0 ? html`
              <div class="dropdown">
                <button
                  class="dropdown-toggle"
                  onclick=${this.toggleOrgDropdown.bind(this)}
                  aria-expanded=${showOrgDropdown}
                  aria-haspopup="true"
                >
                  ${currentOrg ? currentOrg.name : "Organisasjonar"}
                  ${chevronDown}
                </button>
                ${showOrgDropdown ? html`
                  <div class="dropdown-menu left">
                    <div class="dropdown-header">Mine organisasjonar</div>
                    ${organizations.map(org => html`
                      <a
                        href=${`/org-innstillingar.html?slug=${org.slug}`}
                        class="dropdown-item ${org.slug === currentOrgSlug ? "active" : ""}"
                      >
                        ${org.name}
                        ${roleBadge(org.myRole)}
                      </a>
                    `)}
                    <div class="dropdown-divider"></div>
                    <a href="/org/ny.html" class="dropdown-item">
                      + Ny organisasjon
                    </a>
                  </div>
                ` : ""}
              </div>
            ` : html`
              <a href="/org/ny.html" class="login-link">
                Opprett organisasjon
              </a>
            `}

            <!-- User Menu -->
            <div class="dropdown">
              <button
                class="dropdown-toggle"
                onclick=${this.toggleUserDropdown.bind(this)}
                aria-expanded=${showUserDropdown}
                aria-haspopup="true"
              >
                ${user.name || user.email.split("@")[0]}
                ${chevronDown}
              </button>
              ${showUserDropdown ? html`
                <div class="dropdown-menu">
                  <div class="dropdown-header">${user.email}</div>
                  <a href="/oversikt.html" class="dropdown-item">
                    Oversikt
                  </a>
                  <div class="dropdown-divider"></div>
                  <button
                    class="dropdown-item"
                    onclick=${this.handleLogout.bind(this)}
                  >
                    Logg ut
                  </button>
                </div>
              ` : ""}
            </div>
          ` : html`
            <!-- Not logged in -->
            <a href="/login.html" class="login-link">Logg inn</a>
          `}
        </div>
      </nav>
    `;
  },
});
