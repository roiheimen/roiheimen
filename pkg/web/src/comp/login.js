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
    ${self} form {
      align-items: center;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      min-height: 180px;
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
    ${self} .links {
      grid-column: 1 / 3;
      text-align: center;
      margin-top: 10px;
      font-size: 14px;
    }
    ${self} .links a {
      color: var(--roi-theme-main-color);
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
          userJwtToken
        }
      }
    `;

    try {
      const res = await gql(mutation, { email, password }, { jwt: false });
      const { authenticateUser: { userJwtToken } } = res;

      if (!userJwtToken) {
        this.state.error = "Feil e-post eller passord";
        this.state.loading = false;
        this.render();
        return;
      }

      // Store JWT and redirect to dashboard
      this.creds.jwt = userJwtToken;
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
    ${this.children}
    <form onsubmit=${this}>
      <label for="email">E-post</label>
      <input name="email" id="email" type="email" required autocomplete="email" />

      <label for="password">Passord</label>
      <input name="password" id="password" type="password" required autocomplete="current-password" />

      ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

      <input type="submit" value=${this.state.loading ? "Loggar inn..." : "Logg inn"} disabled=${this.state.loading} />

      <div class="links">
        <a href="/gloeymt-passord.html">Gløymt passord?</a>
      </div>
    </form>
    `;
  },
});
