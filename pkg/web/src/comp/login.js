import { define, html } from "/web_modules/heresy.js";

import storage, { save } from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

define("RoiLogin", {
  mappedAttributes: ["err"],
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: false,
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
    ${self} input[type="email"],
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
    ${self} input[type="email"]:hover,
    ${self} input[type="password"]:hover {
      border-color: #cbd5e1;
    }
    ${self} input[type="email"]:focus,
    ${self} input[type="password"]:focus {
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
    ${self} .links {
      text-align: center;
      font-size: 0.875rem;
    }
    ${self} .links a {
      color: var(--roi-theme-main-color);
      text-decoration: none;
      font-weight: 500;
    }
    ${self} .links a:hover {
      text-decoration: underline;
    }
    `;
  },
  async onsubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email").trim();
    const password = form.get("password");

    if (!email || !password) {
      this.state.error = "E-post og passord er obligatorisk";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const mutation = `
      mutation Login($email: String!, $password: String!) {
        authenticateUser(input: {email: $email, password: $password}) {
          jwtToken
        }
      }
    `;

    try {
      const res = await gql(mutation, { email, password }, { jwt: false });
      const jwtToken = res?.authenticateUser?.jwtToken;

      if (!jwtToken) {
        this.state.error = "Feil e-post eller passord";
        this.state.loading = false;
        this.render();
        return;
      }

      // Store JWT and redirect to dashboard
      this.creds.jwt = jwtToken;
      save("creds");
      location.assign("/oversikt.html");
    } catch (error) {
      this.state.loading = false;
      // Extract error message from GraphQL response
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      // Translate common error messages to Norwegian
      this.state.error = messages.map((msg) => {
        if (msg.includes("temporarily locked")) {
          return "Kontoen er midlertidig låst. Prøv igjen seinare.";
        }
        if (msg.includes("not verified")) {
          return "E-postadressa er ikkje stadfesta. Sjekk innboksen din.";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  onerr() {
    this.render();
  },
  render({ useEffect }) {
    useEffect(() => {
      if (new URLSearchParams(location.search).has("logout")) {
        // Clear credentials on logout
        Object.keys(this.creds).forEach((k) => delete this.creds[k]);
        save("creds");
      }
    }, []);

    this.html`
    <form onsubmit=${this}>
      <div class="form-group">
        <label for="email">E-post</label>
        <input name="email" id="email" type="email" required autocomplete="email" placeholder="namn@eksempel.no" />
      </div>

      <div class="form-group">
        <label for="password">Passord</label>
        <input name="password" id="password" type="password" required autocomplete="current-password" placeholder="Skriv inn passordet ditt" />
      </div>

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <button type="submit" class="btn-submit" disabled=${this.state.loading}>
        ${this.state.loading ? html`<span class="spinner"></span>` : ""}
        ${this.state.loading ? "Loggar inn..." : "Logg inn"}
      </button>

      <div class="links">
        <a href="/gloeymt-passord.html">Gløymt passord?</a>
      </div>
    </form>
    `;
  },
});
