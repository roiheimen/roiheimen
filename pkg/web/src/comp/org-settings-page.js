import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";
import "./org-settings.js";
import "./breadcrumbs.js";

define("RoiOrgSettingsPage", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      org: null,
      error: null,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }

    this.loadOrganization();
  },
  style(self) {
    return `
    ${self} .error {
      color: red;
      padding: 20px;
      text-align: center;
    }
    ${self} .back-link {
      margin-top: 20px;
      text-align: center;
    }
    ${self} .back-link a {
      color: var(--roi-theme-main-color);
    }
    ${self} .org-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    ${self} .org-header h2 {
      margin: 0;
    }
    ${self} .org-nav {
      display: flex;
      gap: 8px;
    }
    ${self} .org-nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: #666;
      border-radius: 4px;
    }
    ${self} .org-nav a:hover {
      background: #f3f4f6;
    }
    ${self} .org-nav a.active {
      background: var(--roi-theme-main-color);
      color: white;
    }
    `;
  },
  getSlugFromUrl() {
    // Get slug from query parameter: ?slug=xxx
    const params = new URLSearchParams(window.location.search);
    return params.get("slug");
  },
  async loadOrganization() {
    const slug = this.getSlugFromUrl();
    if (!slug) {
      this.state.error = "Ugyldig URL - organisasjon ikkje funnen";
      this.state.loading = false;
      this.render();
      return;
    }

    try {
      const query = `
        query GetOrganization($orgSlug: String!) {
          getOrganizationBySlug(orgSlug: $orgSlug) {
            id
            slug
            name
            config
            createdAt
            myRole
          }
        }
      `;

      const result = await gql(query, { orgSlug: slug }, { jwt: this.creds.jwt });
      if (!result.getOrganizationBySlug) {
        this.state.error = "Organisasjonen finst ikkje eller du har ikkje tilgang";
        this.state.loading = false;
      } else {
        this.state.org = result.getOrganizationBySlug;
        this.state.loading = false;
      }
    } catch (err) {
      this.state.error = err.message || "Kunne ikkje lasta organisasjonen";
      this.state.loading = false;
    }
    this.render();
  },
  render() {
    const { loading, org, error } = this.state;
    const slug = this.getSlugFromUrl();

    if (loading) {
      return this.html`<p>Lastar...</p>`;
    }

    if (error) {
      return this.html`
        <p class="error">${error}</p>
        <div class="back-link">
          <a href="/oversikt.html">Tilbake til oversikt</a>
        </div>
      `;
    }

    const breadcrumbItems = [
      { label: "Oversikt", href: "/oversikt.html" },
      { label: org.name, href: `/org-innstillingar.html?slug=${slug}` },
      { label: "Innstillingar" },
    ];

    return this.html`
      <roi-breadcrumbs .items=${breadcrumbItems}></roi-breadcrumbs>
      <div class="org-header">
        <h2>${org.name}</h2>
        <nav class="org-nav">
          <a href=${`/org-medlemer.html?slug=${slug}`}>Medlemer</a>
          <a href=${`/org-innstillingar.html?slug=${slug}`} class="active">Innstillingar</a>
        </nav>
      </div>
      <div is="roi-org-settings" .org=${org}></div>
    `;
  },
});
