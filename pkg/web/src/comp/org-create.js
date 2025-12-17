import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";
import storage from "../lib/storage.js";
import "./breadcrumbs.js";

define("RoiOrgCreate", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: false,
      error: null,
      success: false,
      createdOrg: null,
    };

    // Redirect to login if not authenticated
    if (!this.creds.jwt) {
      window.location.href = "/login.html";
      return;
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
    ${self} input {
      border-radius: 2px;
      border: thin solid #aaa;
      padding: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    ${self} input[type=submit] {
      grid-column: 1 / 3;
      margin: 10px 0 0 auto;
      width: 150px;
      cursor: pointer;
      background-color: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
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
    ${self} .slug-preview {
      grid-column: 1 / 3;
      font-size: 13px;
      color: #666;
      margin: 5px 0 0 0;
      padding: 8px 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    ${self} .slug-preview code {
      font-family: monospace;
      background: #e8e8e8;
      padding: 2px 6px;
      border-radius: 2px;
    }
    `;
  },
  generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[æ]/g, 'ae')
      .replace(/[ø]/g, 'o')
      .replace(/[å]/g, 'a')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
  },
  oninput(event) {
    if (event.target.name === 'name') {
      const slugInput = this.querySelector('input[name="slug"]');
      if (slugInput && !slugInput.dataset.userEdited) {
        slugInput.value = this.generateSlug(event.target.value);
      }
    }
    if (event.target.name === 'slug') {
      event.target.dataset.userEdited = 'true';
    }
    this.render();
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    const slug = form.get("slug").trim().toLowerCase();

    // Client-side validation
    if (!name) {
      this.state.error = "Namn er obligatorisk";
      this.render();
      return;
    }

    if (!slug) {
      this.state.error = "Kortnavn er obligatorisk";
      this.render();
      return;
    }

    if (slug.length < 2) {
      this.state.error = "Kortnavn må vera minst 2 teikn";
      this.render();
      return;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      this.state.error = "Kortnavn kan berre innehalda små bokstavar, tal og bindestrek";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation CreateOrganization($slug: String!, $name: String!) {
        createOrganization(input: {slug: $slug, name: $name}) {
          organization {
            id
            slug
            name
          }
        }
      }
    `;

    try {
      const result = await gql(mutation, { slug, name });
      this.state.success = true;
      this.state.createdOrg = result.createOrganization.organization;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.state.loading = false;
      // Extract error message from GraphQL response
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      // Translate common error messages to Norwegian
      this.state.error = messages.map((msg) => {
        if (msg.includes("duplicate key") || msg.includes("unique") || msg.includes("already exists")) {
          return "Det finst allereie ein organisasjon med dette kortnamnet";
        }
        if (msg.includes("must be logged in")) {
          return "Du må vera innlogga for å oppretta ein organisasjon";
        }
        if (msg.includes("check")) {
          return "Ugyldig kortnavn - bruk berre små bokstavar, tal og bindestrek (minst 2 teikn)";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  render() {
    if (this.state.success) {
      const org = this.state.createdOrg;
      this.html`
        <div class="success">
          <h3>Organisasjonen er oppretta!</h3>
          <p><strong>${org.name}</strong> (${org.slug})</p>
          <p>Du er no eigar av denne organisasjonen.</p>
          <p><a href="/oversikt.html">Gå til oversikt</a></p>
        </div>
      `;
      return;
    }

    const slugInput = this.querySelector?.('input[name="slug"]');
    const currentSlug = slugInput?.value || '';

    const breadcrumbItems = [
      { label: "Oversikt", href: "/oversikt.html" },
      { label: "Ny organisasjon" },
    ];

    this.html`
    <roi-breadcrumbs .items=${breadcrumbItems}></roi-breadcrumbs>
    ${this.children}
    <form onsubmit=${this} oninput=${this}>
      <label for="name">Namn</label>
      <input name="name" id="name" type="text" required autocomplete="organization"
        placeholder="T.d. Noregs Mållag" />

      <label for="slug">Kortnavn</label>
      <input name="slug" id="slug" type="text" required
        placeholder="t.d. noregs-mallag"
        pattern="[a-z0-9-]+"
        minlength="2"
        maxlength="64" />

      <p class="hint">Kortnamnet vert brukt i nettadresser og må vera unikt</p>

      ${currentSlug ? html`
        <p class="slug-preview">
          Nettadresse: <code>roiheimen.no/org/${currentSlug}</code>
        </p>
      ` : ''}

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <input type="submit" value=${this.state.loading ? "Opprettar..." : "Opprett organisasjon"} disabled=${this.state.loading} />
    </form>
    `;
  },
});
