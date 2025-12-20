import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";
import "./breadcrumbs.js";

define("RoiMeetingCreate", {
  oninit() {
    this.creds = storage("creds");

    // Get org slug from URL query parameter
    const params = new URLSearchParams(window.location.search);
    this.orgSlug = params.get("org");

    this.state = {
      loading: false,
      loadingOrg: true,
      error: null,
      success: false,
      createdMeeting: null,
      organization: null,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
    }

    // Load organization data
    if (this.orgSlug) {
      this.loadOrganization();
    } else {
      this.state.loadingOrg = false;
      this.state.error = "Manglar organisasjonsparameter i URL (?org=slug)";
      this.render();
    }
  },
  style(self) {
    return `
    ${self} form {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
    }
    ${self} label {
      padding-right: 4px;
    }
    ${self} input, ${self} textarea {
      border-radius: 2px;
      border: thin solid #aaa;
      padding: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    ${self} textarea {
      resize: vertical;
      min-height: 60px;
      font-family: inherit;
    }
    ${self} input[type=submit] {
      grid-column: 1 / 3;
      margin: 10px 0 0 auto;
      width: 150px;
      cursor: pointer;
      background-color: var(--roi-primary);
      color: var(--roi-text-inverse);
      border: none;
      font-size: 16px;
    }
    ${self} input[type=submit]:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${self} .err {
      color: red;
      grid-column: 1 / 3;
      margin: 0;
    }
    ${self} .success {
      color: green;
      text-align: center;
      padding: 20px;
    }
    ${self} .success h3 {
      margin-top: 0;
    }
    ${self} .hint {
      grid-column: 1 / 3;
      font-size: 14px;
      color: #666;
      margin: 0;
    }
    ${self} .id-preview {
      grid-column: 1 / 3;
      font-size: 13px;
      color: #666;
      margin: 5px 0 0 0;
      padding: 8px 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    ${self} .id-preview code {
      font-family: monospace;
      background: #e8e8e8;
      padding: 2px 6px;
      border-radius: 2px;
    }
    ${self} .org-info {
      background: #f0f7ff;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    ${self} .org-info strong {
      color: var(--roi-primary);
    }
    `;
  },
  async loadOrganization() {
    try {
      const query = `
        query GetOrganization($orgSlug: String!) {
          getOrganizationBySlug(orgSlug: $orgSlug) {
            id
            slug
            name
            myRole
          }
        }
      `;

      const result = await gql(query, { orgSlug: this.orgSlug }, { jwt: this.creds.jwt });
      const org = result.getOrganizationBySlug;

      if (!org) {
        this.state.error = "Fann ikkje organisasjonen";
        this.state.loadingOrg = false;
        this.render();
        return;
      }

      // Check permission
      if (!["owner", "admin"].includes(org.myRole)) {
        this.state.error = "Du må vera admin eller eigar for å oppretta mote";
        this.state.loadingOrg = false;
        this.render();
        return;
      }

      this.state.organization = org;
      this.state.loadingOrg = false;
      this.render();
    } catch (err) {
      this.state.error = err.message || "Kunne ikkje lasta organisasjon";
      this.state.loadingOrg = false;
      this.render();
    }
  },
  generateMeetingId(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[æ]/g, 'ae')
      .replace(/[ø]/g, 'o')
      .replace(/[å]/g, 'a')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 31);
  },
  oninput(event) {
    if (event.target.name === 'title') {
      const idInput = this.querySelector('input[name="meetingId"]');
      if (idInput && !idInput.dataset.userEdited) {
        idInput.value = this.generateMeetingId(event.target.value);
      }
    }
    if (event.target.name === 'meetingId') {
      event.target.dataset.userEdited = 'true';
    }
    this.render();
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = form.get("title").trim();
    const meetingId = form.get("meetingId").trim().toLowerCase();

    // Client-side validation
    if (!title) {
      this.state.error = "Tittel er obligatorisk";
      this.render();
      return;
    }

    if (!meetingId) {
      this.state.error = "Mote-ID er obligatorisk";
      this.render();
      return;
    }

    if (meetingId.length < 2) {
      this.state.error = "Mote-ID må vera minst 2 teikn";
      this.render();
      return;
    }

    if (!/^[a-z0-9-]+$/.test(meetingId)) {
      this.state.error = "Mote-ID kan berre innehalda små bokstavar, tal og bindestrek";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation CreateOrgMeeting($orgId: Int!, $meetingId: String!, $title: String!, $config: JSON!) {
        createOrgMeeting(input: {orgId: $orgId, meetingId: $meetingId, meetingTitle: $title, meetingConfig: $config}) {
          meeting {
            id
            title
            createdAt
          }
        }
      }
    `;

    try {
      const result = await gql(mutation, {
        orgId: this.state.organization.id,
        meetingId,
        title,
        config: {}
      }, { jwt: this.creds.jwt });

      this.state.success = true;
      this.state.createdMeeting = result.createOrgMeeting.meeting;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.state.loading = false;
      // Extract error message from GraphQL response
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      // Translate common error messages to Norwegian
      this.state.error = messages.map((msg) => {
        if (msg.includes("duplicate key") || msg.includes("unique") || msg.includes("already exists")) {
          return "Det finst allereie eit mote med denne ID-en";
        }
        if (msg.includes("must be logged in")) {
          return "Du må vera innlogga for å oppretta eit mote";
        }
        if (msg.includes("not a member")) {
          return "Du er ikkje medlem av denne organisasjonen";
        }
        if (msg.includes("admin or owner")) {
          return "Du må vera admin eller eigar for å oppretta mote";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  render() {
    const { loadingOrg, loading, error, success, organization, createdMeeting } = this.state;

    if (loadingOrg) {
      return this.html`<p>Lastar...</p>`;
    }

    if (success) {
      return this.html`
        <div class="success">
          <h3>Motet er oppretta!</h3>
          <p><strong>${createdMeeting.title}</strong> (${createdMeeting.id})</p>
          <p>
            <a href=${`/manage.html?id=${createdMeeting.id}`}>Gå til administrasjon</a>
            |
            <a href="/oversikt.html">Tilbake til oversikt</a>
          </p>
        </div>
      `;
    }

    if (error && !organization) {
      return this.html`<p class="err">${error}</p>`;
    }

    const meetingIdInput = this.querySelector?.('input[name="meetingId"]');
    const currentId = meetingIdInput?.value || '';

    const breadcrumbItems = [
      { label: "Oversikt", href: "/oversikt.html" },
    ];
    if (organization) {
      breadcrumbItems.push({
        label: organization.name,
        href: `/org-innstillingar.html?slug=${organization.slug}`,
      });
    }
    breadcrumbItems.push({ label: "Nytt mote" });

    return this.html`
    <roi-breadcrumbs .items=${breadcrumbItems}></roi-breadcrumbs>
    ${organization ? html`
      <div class="org-info">
        Opprettar mote under <strong>${organization.name}</strong>
      </div>
    ` : ''}
    <form onsubmit=${this} oninput=${this}>
      <label for="title">Tittel</label>
      <input name="title" id="title" type="text" required
        placeholder="T.d. Landsmote 2025" />

      <label for="meetingId">Mote-ID</label>
      <input name="meetingId" id="meetingId" type="text" required
        placeholder="t.d. landsmote-2025"
        pattern="[a-z0-9-]+"
        minlength="2"
        maxlength="31" />

      <p class="hint">Mote-ID vert brukt i nettadresser og må vera unik</p>

      ${currentId ? html`
        <p class="id-preview">
          Nettadresse: <code>roiheimen.no/queue.html?id=${currentId}</code>
        </p>
      ` : ''}

      ${error ? html`<p class="err">${error}</p>` : ""}

      <input type="submit" value=${loading ? "Opprettar..." : "Opprett mote"} disabled=${loading} />
    </form>
    `;
  },
});
