import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

define("RoiDashboard", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      organizations: [],
      error: null,
    };
    this.loadData();
  },
  style(self) {
    return `
    ${self} .orgs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    ${self} .org-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      background: #fafafa;
    }
    ${self} .org-card h3 {
      margin: 0 0 10px 0;
      color: var(--roi-theme-main-color);
    }
    ${self} .org-card p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
    ${self} .empty {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    ${self} .actions {
      margin-top: 30px;
      text-align: center;
    }
    ${self} .btn {
      display: inline-block;
      padding: 12px 24px;
      background: var(--roi-theme-main-color);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 16px;
    }
    ${self} .btn:hover {
      opacity: 0.9;
    }
    ${self} .error {
      color: red;
      padding: 20px;
      text-align: center;
    }
    `;
  },
  async loadData() {
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }

    try {
      const query = `
        query MyOrganizations {
          myOrganizations {
            nodes {
              id
              slug
              name
              createdAt
            }
          }
        }
      `;

      const result = await gql(query, {}, this.creds.jwt);
      this.state.organizations = result.myOrganizations?.nodes || [];
      this.state.loading = false;
    } catch (err) {
      this.state.error = err.message || "Kunne ikkje lasta data";
      this.state.loading = false;
    }
    this.render();
  },
  render() {
    const { loading, organizations, error } = this.state;

    if (loading) {
      return this.html`<p>Lastar...</p>`;
    }

    if (error) {
      return this.html`<p class="error">${error}</p>`;
    }

    return this.html`
      <h2>Mine organisasjonar</h2>
      ${
        organizations.length === 0
          ? html`
              <div class="empty">
                <p>Du er ikkje medlem av nokon organisasjonar enno.</p>
              </div>
            `
          : html`
              <div class="orgs">
                ${organizations.map(
                  (org) => html`
                    <div class="org-card">
                      <h3>${org.name}</h3>
                      <p>${org.slug}</p>
                    </div>
                  `
                )}
              </div>
            `
      }
      <div class="actions">
        <a href="/org/ny.html" class="btn">Opprett ny organisasjon</a>
      </div>
    `;
  },
});
