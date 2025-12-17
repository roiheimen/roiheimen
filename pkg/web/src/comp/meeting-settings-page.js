import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";
import "./meeting-settings.js";
import "./breadcrumbs.js";

define("RoiMeetingSettingsPage", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      meeting: null,
      organization: null,
      error: null,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }

    this.loadMeeting();
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
    ${self} .meeting-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    ${self} .meeting-header h2 {
      margin: 0;
    }
    ${self} .meeting-header h2 small {
      display: block;
      font-size: 14px;
      font-weight: normal;
      color: #666;
      margin-top: 4px;
    }
    ${self} .meeting-nav {
      display: flex;
      gap: 8px;
    }
    ${self} .meeting-nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: #666;
      border-radius: 4px;
    }
    ${self} .meeting-nav a:hover {
      background: #f3f4f6;
    }
    ${self} .meeting-nav a.active {
      background: var(--roi-theme-main-color);
      color: white;
    }
    `;
  },
  getMeetingIdFromUrl() {
    // Get meeting ID from query parameter: ?id=xxx
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  },
  async loadMeeting() {
    const meetingId = this.getMeetingIdFromUrl();
    if (!meetingId) {
      this.state.error = "Ugyldig URL - mote ikkje funne";
      this.state.loading = false;
      this.render();
      return;
    }

    try {
      const query = `
        query GetMeetingWithOrg($meetingId: String!) {
          meetingById(id: $meetingId) {
            id
            title
            config
            createdAt
            organizationId
            organization {
              id
              slug
              name
              myRoleInOrganization
            }
          }
        }
      `;

      const result = await gql(query, { meetingId }, this.creds.jwt);
      if (!result.meetingById) {
        this.state.error = "Motet finst ikkje eller du har ikkje tilgang";
        this.state.loading = false;
      } else {
        this.state.meeting = result.meetingById;
        this.state.organization = result.meetingById.organization;
        this.state.loading = false;
      }
    } catch (err) {
      this.state.error = err.message || "Kunne ikkje lasta motet";
      this.state.loading = false;
    }
    this.render();
  },
  render() {
    const { loading, meeting, organization, error } = this.state;
    const meetingId = this.getMeetingIdFromUrl();

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
    ];
    if (organization) {
      breadcrumbItems.push({
        label: organization.name,
        href: `/org-innstillingar.html?slug=${organization.slug}`,
      });
    }
    breadcrumbItems.push(
      { label: meeting.title, href: `/mote-innstillingar.html?id=${meetingId}` },
      { label: "Innstillingar" }
    );

    return this.html`
      <roi-breadcrumbs .items=${breadcrumbItems}></roi-breadcrumbs>
      <div class="meeting-header">
        <h2>
          ${meeting.title}
          <small>${organization?.name || ""}</small>
        </h2>
        <nav class="meeting-nav">
          <a href=${`/manage.html?id=${meetingId}`}>Administrer</a>
          <a href=${`/mote-innstillingar.html?id=${meetingId}`} class="active">Innstillingar</a>
        </nav>
      </div>
      <div is="roi-meeting-settings" .meeting=${meeting} .organization=${organization}></div>
    `;
  },
});
