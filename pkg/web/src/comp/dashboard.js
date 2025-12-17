import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";
import "./org-card.js";
import "./meeting-card.js";
import "./activity-feed.js";

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
    ${self} .section {
      margin-bottom: 40px;
    }
    ${self} h2 {
      margin-bottom: 16px;
      color: #333;
    }
    ${self} .orgs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 20px;
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
    ${self} .btn-secondary {
      background: #6b7280;
    }
    ${self} .error {
      color: red;
      padding: 20px;
      text-align: center;
    }
    ${self} .org-section {
      margin-bottom: 32px;
      padding: 20px;
      background: #fafafa;
      border-radius: 8px;
    }
    ${self} .org-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    ${self} .org-header h3 {
      margin: 0;
      font-size: 18px;
      color: var(--roi-theme-main-color);
    }
    ${self} .org-header a {
      font-size: 14px;
      color: #666;
      text-decoration: none;
    }
    ${self} .org-header a:hover {
      color: var(--roi-theme-main-color);
    }
    ${self} .meetings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    ${self} .no-meetings {
      color: #888;
      font-size: 14px;
      padding: 12px 0;
    }
    ${self} .create-meeting-btn {
      display: inline-block;
      padding: 8px 16px;
      background: var(--roi-theme-main-color);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      margin-top: 12px;
    }
    ${self} .create-meeting-btn:hover {
      opacity: 0.9;
    }
    ${self} .dashboard-layout {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 40px;
      align-items: start;
    }
    @media (max-width: 900px) {
      ${self} .dashboard-layout {
        grid-template-columns: 1fr;
      }
      ${self} .activity-section {
        order: -1;
      }
    }
    ${self} .main-content {
      min-width: 0;
    }
    ${self} .activity-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    ${self} .activity-section h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #374151;
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
              myRole
              organizationMeetings {
                nodes {
                  id
                  title
                  createdAt
                  saks {
                    totalCount
                  }
                }
              }
            }
          }
        }
      `;

      const result = await gql(query, {}, { jwt: this.creds.jwt });
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

    // Check if there are any meetings across all organizations
    const totalMeetings = organizations.reduce(
      (sum, org) => sum + (org.organizationMeetings?.nodes?.length || 0),
      0
    );

    return this.html`
      <div class="dashboard-layout">
        <div class="main-content">
          <div class="section">
            <h2>Mine organisasjonar og mote</h2>
            ${
              organizations.length === 0
                ? html`
                    <div class="empty">
                      <p>Du er ikkje medlem av nokon organisasjonar enno.</p>
                      <p>Opprett ein organisasjon for a koma i gang.</p>
                    </div>
                  `
                : html`
                    ${organizations.map(
                      (org) => html`
                        <div class="org-section">
                          <div class="org-header">
                            <h3>${org.name}</h3>
                            <a href=${`/org-innstillingar.html?slug=${org.slug}`}>Innstillingar</a>
                          </div>
                          ${org.organizationMeetings?.nodes?.length > 0
                            ? html`
                                <div class="meetings-grid">
                                  ${org.organizationMeetings.nodes.map(
                                    (meeting) => html`
                                      <div is="roi-meeting-card" .meeting=${meeting} .orgSlug=${org.slug}></div>
                                    `
                                  )}
                                </div>
                              `
                            : html`<p class="no-meetings">Ingen mote i denne organisasjonen enno.</p>`}
                          ${["owner", "admin"].includes(org.myRole)
                            ? html`
                                <a href=${`/meeting/ny.html?org=${org.slug}`} class="create-meeting-btn">
                                  + Nytt mote
                                </a>
                              `
                            : ""}
                        </div>
                      `
                    )}
                  `
            }
          </div>
          <div class="actions">
            <a href="/org/ny.html" class="btn">Opprett ny organisasjon</a>
          </div>
        </div>
        <div class="activity-section">
          <h3>Siste aktivitet</h3>
          <div is="roi-activity-feed"></div>
        </div>
      </div>
    `;
  },
});
