import { define, html } from "/web_modules/heresy.js";
import { gql } from "../lib/graphql.js";

define("RoiSignup", {
  mappedAttributes: ["err"],
  oninit() {
    this.state = {
      loading: false,
      error: null,
      success: false,
    };
  },
  style(self) {
    return `
    ${self} form {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      min-height: 200px;
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
    `;
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    const email = form.get("email").trim();
    const password = form.get("password");
    const password2 = form.get("password2");

    // Client-side validation
    if (!name || !email || !password) {
      this.state.error = "Alle felt er obligatoriske";
      this.render();
      return;
    }

    if (password !== password2) {
      this.state.error = "Passorda er ikkje like";
      this.render();
      return;
    }

    if (password.length < 8) {
      this.state.error = "Passordet m\u00e5 vera minst 8 teikn";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation Register($email: String!, $password: String!, $name: String!) {
        registerUser(input: {email: $email, password: $password, name: $name}) {
          registerUserResult {
            userId
          }
        }
      }
    `;

    try {
      await gql(mutation, { email, password, name }, { jwt: false });
      this.state.success = true;
      this.state.loading = false;
      this.render();
    } catch (error) {
      this.state.loading = false;
      // Extract error message from GraphQL response
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      // Translate common error messages to Norwegian
      this.state.error = messages.map((msg) => {
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          return "Det finst allereie ein konto med denne e-postadressa";
        }
        if (msg.includes("Password must be at least")) {
          return "Passordet m\u00e5 vera minst 8 teikn";
        }
        if (msg.includes("valid email")) {
          return "Ugyldig e-postadresse";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  onerr() {
    this.render();
  },
  render() {
    if (this.state.success) {
      this.html`
        <div class="success">
          <h3>Registreringa var vellukka!</h3>
          <p>Vi har sendt ein e-post til deg med ein stadfestingslenke.</p>
          <p>Klikk p\u00e5 lenka i e-posten for \u00e5 aktivera kontoen din.</p>
          <p><a href="/">G\u00e5 til innlogging</a></p>
        </div>
      `;
      return;
    }

    this.html`
    ${this.children}
    <form onsubmit=${this}>
      <label for="name">Namn</label>
      <input name="name" id="name" type="text" required autocomplete="name" />

      <label for="email">E-post</label>
      <input name="email" id="email" type="email" required autocomplete="email" />

      <label for="password">Passord</label>
      <input name="password" id="password" type="password" required autocomplete="new-password" minlength="8" />

      <label for="password2">Stadfest passord</label>
      <input name="password2" id="password2" type="password" required autocomplete="new-password" minlength="8" />

      <p class="hint">Passordet m\u00e5 vera minst 8 teikn</p>

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <input type="submit" value=${this.state.loading ? "Registrerer..." : "Registrer"} disabled=${this.state.loading} />
    </form>
    `;
  },
});
