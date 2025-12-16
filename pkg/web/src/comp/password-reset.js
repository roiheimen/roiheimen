import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";

define("RoiPasswordReset", {
  oninit() {
    this.state = {
      loading: false,
      success: false,
      error: null,
      invalidToken: false,
    };
    // Check for token in URL on init
    this.checkToken();
  },
  style(self) {
    return `
    ${self} form {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      min-height: 150px;
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
    ${self} .hint {
      grid-column: 1 / 3;
      font-size: 14px;
      color: #666;
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
    ${self} .invalid {
      color: red;
      text-align: center;
      padding: 20px;
    }
    ${self} .invalid h3 {
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
  checkToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      this.state.invalidToken = true;
      this.render();
    }
  },
  getToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    const password2 = form.get("password2");
    const token = this.getToken();

    if (!token) {
      this.state.error = "Manglande token. Sjekk at du brukte heile lenka frå e-posten.";
      this.render();
      return;
    }

    if (!password) {
      this.state.error = "Passord er påkravd";
      this.render();
      return;
    }

    if (password !== password2) {
      this.state.error = "Passorda er ikkje like";
      this.render();
      return;
    }

    if (password.length < 8) {
      this.state.error = "Passordet må vera minst 8 teikn";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation ResetPassword($token: String!, $newPassword: String!) {
        resetPassword(input: {token: $token, newPassword: $newPassword}) {
          boolean
        }
      }
    `;

    try {
      const data = await gql(mutation, { token, newPassword: password }, { jwt: false });
      const success = data?.resetPassword?.boolean;

      this.state.loading = false;
      if (success) {
        this.state.success = true;
      } else {
        this.state.error = "Ugyldig eller utgått token. Be om ny lenke for å nullstilla passord.";
      }
      this.render();
    } catch (error) {
      this.state.loading = false;
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      this.state.error = messages.map((msg) => {
        if (msg.includes("Password must be at least")) {
          return "Passordet må vera minst 8 teikn";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  render() {
    if (this.state.invalidToken) {
      this.html`
        <div class="invalid">
          <h3>Manglande token</h3>
          <p>Sjekk at du brukte heile lenka frå e-posten.</p>
          <a href="/gloeymt-passord.html">Be om ny lenke</a>
        </div>
      `;
      return;
    }

    if (this.state.success) {
      this.html`
        <div class="success">
          <h3>Passordet er oppdatert!</h3>
          <p>Du kan no logga inn med det nye passordet ditt.</p>
          <a href="/">Logg inn</a>
        </div>
      `;
      return;
    }

    this.html`
    ${this.children}
    <form onsubmit=${this}>
      <label for="password">Nytt passord</label>
      <input name="password" id="password" type="password" required autocomplete="new-password" minlength="8" />

      <label for="password2">Stadfest passord</label>
      <input name="password2" id="password2" type="password" required autocomplete="new-password" minlength="8" />

      <p class="hint">Passordet må vera minst 8 teikn</p>

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <input type="submit" value=${this.state.loading ? "Lagrar..." : "Lagra passord"} disabled=${this.state.loading} />
    </form>
    `;
  },
});
