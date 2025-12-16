import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";

define("RoiEmailVerify", {
  oninit() {
    this.state = {
      loading: true,
      success: false,
      error: null,
    };
    // Auto-verify on page load if token in URL
    this.verifyFromUrl();
  },
  style(self) {
    return `
    ${self} {
      display: block;
      text-align: center;
      padding: 20px;
    }
    ${self} .loading {
      color: #666;
    }
    ${self} .success {
      color: green;
    }
    ${self} .success h3 {
      margin-top: 0;
    }
    ${self} .error {
      color: red;
    }
    ${self} .error h3 {
      margin-top: 0;
    }
    ${self} a {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background-color: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      text-decoration: none;
      border-radius: 4px;
    }
    ${self} a:hover {
      opacity: 0.9;
    }
    `;
  },
  async verifyFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      this.state.loading = false;
      this.state.error = "Manglande token. Sjekk at du brukte heile lenka frå e-posten.";
      this.render();
      return;
    }

    await this.verifyToken(token);
  },
  async verifyToken(token) {
    const mutation = `
      mutation VerifyEmail($token: String!) {
        verifyEmail(input: {token: $token}) {
          boolean
        }
      }
    `;

    try {
      const data = await gql(mutation, { token }, { jwt: false });
      const success = data?.verifyEmail?.boolean;

      this.state.loading = false;
      if (success) {
        this.state.success = true;
      } else {
        this.state.error = "Ugyldig eller utgått token. Be om ein ny stadfestings-e-post.";
      }
      this.render();
    } catch (error) {
      this.state.loading = false;
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  render() {
    if (this.state.loading) {
      this.html`
        <div class="loading">
          <p>Verifiserer e-postadressa di...</p>
        </div>
      `;
      return;
    }

    if (this.state.success) {
      this.html`
        <div class="success">
          <h3>E-postadressa er stadfesta!</h3>
          <p>Kontoen din er no aktivert. Du kan logga inn.</p>
          <a href="/">Logg inn</a>
        </div>
      `;
      return;
    }

    this.html`
      <div class="error">
        <h3>Stadfesting feila</h3>
        <p>${this.state.error}</p>
        <a href="/registrer.html">Registrer deg på nytt</a>
      </div>
    `;
  },
});
