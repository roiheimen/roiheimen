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
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    ${self} form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    ${self} .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    ${self} label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }
    ${self} input[type="password"] {
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      padding: 12px 14px;
      font-size: 1rem;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #fff;
    }
    ${self} input[type="password"]:hover {
      border-color: #cbd5e1;
    }
    ${self} input[type="password"]:focus {
      outline: none;
      border-color: var(--roi-primary);
      box-shadow: 0 0 0 3px rgba(43, 44, 58, 0.08);
    }
    ${self} input::placeholder {
      color: #94a3b8;
    }
    ${self} .btn-submit {
      width: 100%;
      cursor: pointer;
      background-color: var(--roi-primary);
      color: var(--roi-text-inverse);
      border: none;
      border-radius: 10px;
      padding: 14px 20px;
      font-size: 1rem;
      font-weight: 600;
      transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
      margin-top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    ${self} .btn-submit:hover:not(:disabled) {
      background-color: #1f2029;
      box-shadow: 0 4px 12px rgba(43, 44, 58, 0.25);
    }
    ${self} .btn-submit:active:not(:disabled) {
      transform: scale(0.98);
    }
    ${self} .btn-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    ${self} .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    ${self} .err {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #991b1b;
      padding: 12px 14px;
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    ${self} .hint {
      font-size: 0.8rem;
      color: #64748b;
      margin: -12px 0 0;
    }
    ${self} .success {
      text-align: center;
      padding: 24px 0;
    }
    ${self} .success-icon {
      width: 64px;
      height: 64px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #16a34a;
      font-size: 28px;
    }
    ${self} .success h3 {
      margin: 0 0 12px;
      color: #166534;
      font-weight: 600;
      font-size: 1.125rem;
    }
    ${self} .success p {
      color: #475569;
      margin: 8px 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    ${self} .success a {
      display: inline-block;
      margin-top: 16px;
      padding: 12px 24px;
      background-color: var(--roi-primary);
      color: var(--roi-text-inverse);
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    ${self} .success a:hover {
      background-color: #1f2029;
      box-shadow: 0 4px 12px rgba(43, 44, 58, 0.25);
    }
    ${self} .invalid {
      text-align: center;
      padding: 24px 0;
    }
    ${self} .invalid-icon {
      width: 64px;
      height: 64px;
      background: #fef2f2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #dc2626;
      font-size: 28px;
    }
    ${self} .invalid h3 {
      margin: 0 0 12px;
      color: #991b1b;
      font-weight: 600;
      font-size: 1.125rem;
    }
    ${self} .invalid p {
      color: #475569;
      margin: 8px 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    ${self} .invalid a {
      display: inline-block;
      margin-top: 16px;
      padding: 12px 24px;
      background-color: var(--roi-primary);
      color: var(--roi-text-inverse);
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    ${self} .invalid a:hover {
      background-color: #1f2029;
      box-shadow: 0 4px 12px rgba(43, 44, 58, 0.25);
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
          <div class="invalid-icon">!</div>
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
          <div class="success-icon">✓</div>
          <h3>Passordet er oppdatert!</h3>
          <p>Du kan no logga inn med det nye passordet ditt.</p>
          <a href="/">Logg inn</a>
        </div>
      `;
      return;
    }

    this.html`
    <form onsubmit=${this}>
      <div class="form-group">
        <label for="password">Nytt passord</label>
        <input name="password" id="password" type="password" required autocomplete="new-password" minlength="8" placeholder="Minst 8 teikn" />
      </div>

      <div class="form-group">
        <label for="password2">Stadfest passord</label>
        <input name="password2" id="password2" type="password" required autocomplete="new-password" minlength="8" placeholder="Skriv passordet på nytt" />
      </div>

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <button type="submit" class="btn-submit" disabled=${this.state.loading}>
        ${this.state.loading ? html`<span class="spinner"></span>` : ""}
        ${this.state.loading ? "Lagrar..." : "Lagra nytt passord"}
      </button>
    </form>
    `;
  },
});
