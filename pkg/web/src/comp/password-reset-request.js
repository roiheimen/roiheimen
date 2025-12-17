import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";

define("RoiPasswordResetRequest", {
  oninit() {
    this.state = {
      loading: false,
      success: false,
      error: null,
    };
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
    ${self} input[type="email"] {
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      padding: 12px 14px;
      font-size: 1rem;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #fff;
    }
    ${self} input[type="email"]:hover {
      border-color: #cbd5e1;
    }
    ${self} input[type="email"]:focus {
      outline: none;
      border-color: var(--roi-theme-main-color);
      box-shadow: 0 0 0 3px rgba(43, 44, 58, 0.08);
    }
    ${self} input::placeholder {
      color: #94a3b8;
    }
    ${self} .btn-submit {
      width: 100%;
      cursor: pointer;
      background-color: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
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
    ${self} .success {
      text-align: center;
      padding: 24px 0;
    }
    ${self} .success-icon {
      width: 64px;
      height: 64px;
      background: #dbeafe;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #2563eb;
      font-size: 28px;
    }
    ${self} .success h3 {
      margin: 0 0 12px;
      color: #1e40af;
      font-weight: 600;
      font-size: 1.125rem;
    }
    ${self} .success p {
      color: #475569;
      margin: 8px 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    `;
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email").trim();

    if (!email) {
      this.state.error = "E-postadresse er påkravd";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation RequestPasswordReset($email: String!) {
        requestPasswordReset(input: {email: $email}) {
          string
        }
      }
    `;

    try {
      await gql(mutation, { email }, { jwt: false });
      // Always show success to prevent email enumeration
      this.state.success = true;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.state.loading = false;
      // Still show success to prevent email enumeration
      // But log for debugging
      console.error("Password reset request error:", error);
      this.state.success = true;
      this.render();
    }
  },
  render() {
    if (this.state.success) {
      this.html`
        <div class="success">
          <div class="success-icon">✉</div>
          <h3>Sjekk e-posten din</h3>
          <p>Viss det finst ein konto med denne e-postadressa, har vi sendt deg ein e-post med lenke for å nullstilla passordet.</p>
          <p>Sjekk også søppelpost-mappa.</p>
        </div>
      `;
      return;
    }

    this.html`
    <form onsubmit=${this}>
      <div class="form-group">
        <label for="email">E-post</label>
        <input name="email" id="email" type="email" required autocomplete="email" placeholder="namn@eksempel.no" />
      </div>

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <button type="submit" class="btn-submit" disabled=${this.state.loading}>
        ${this.state.loading ? html`<span class="spinner"></span>` : ""}
        ${this.state.loading ? "Sender..." : "Send nullstillingslenke"}
      </button>
    </form>
    `;
  },
});
