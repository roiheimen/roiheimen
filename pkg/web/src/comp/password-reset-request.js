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
    ${self} form {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      min-height: 100px;
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
          boolean
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
          <h3>Sjekk e-posten din</h3>
          <p>Viss det finst ein konto med denne e-postadressa, har vi sendt deg ein e-post med lenke for å nullstilla passordet.</p>
          <p>Sjekk også søppelpost-mappa.</p>
        </div>
      `;
      return;
    }

    this.html`
    ${this.children}
    <form onsubmit=${this}>
      <label for="email">E-post</label>
      <input name="email" id="email" type="email" required autocomplete="email" />

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <input type="submit" value=${this.state.loading ? "Sender..." : "Send lenke"} disabled=${this.state.loading} />
    </form>
    `;
  },
});
