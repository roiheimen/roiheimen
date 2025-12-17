import { define, html } from "/web_modules/heresy.js";

import storage, { save } from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

define("RoiJoinMeeting", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      step: "code", // "code", "confirm", "joining", "success"
      loading: false,
      error: null,
      code: "",
      meetingInfo: null,
      displayName: "",
    };
    // Check for code in URL query param
    this.checkUrlCode();
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
    ${self} input.code-input {
      font-size: 20px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-family: monospace;
    }
    ${self} input[type=submit], ${self} button {
      grid-column: 1 / 3;
      margin: 10px 0 0 auto;
      width: 150px;
      cursor: pointer;
      background-color: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      border: none;
      font-size: 16px;
      padding: 10px;
      border-radius: 2px;
    }
    ${self} input[type=submit]:disabled, ${self} button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${self} .err {
      color: red;
      grid-column: 1 / 3;
      margin: 0;
    }
    ${self} .meeting-info {
      grid-column: 1 / 3;
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
    }
    ${self} .meeting-info h3 {
      margin: 0 0 5px 0;
      color: var(--roi-theme-main-color);
    }
    ${self} .meeting-info p {
      margin: 0;
      color: #666;
    }
    ${self} .success {
      text-align: center;
      padding: 20px;
    }
    ${self} .success h3 {
      color: green;
      margin-top: 0;
    }
    ${self} a.btn {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background-color: var(--roi-theme-main-color);
      color: var(--roi-theme-main-color2, white);
      text-decoration: none;
      border-radius: 4px;
    }
    ${self} a.btn:hover {
      opacity: 0.9;
    }
    ${self} .back-link {
      grid-column: 1 / 3;
      text-align: center;
      margin-top: 10px;
    }
    ${self} .back-link a {
      color: var(--roi-theme-main-color);
      cursor: pointer;
    }
    ${self} .login-required {
      text-align: center;
      padding: 20px;
    }
    ${self} .login-required p {
      margin-bottom: 15px;
    }
    `;
  },
  checkUrlCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      this.state.code = code.toUpperCase();
      // Auto-validate the code
      this.validateCode();
    }
  },
  isLoggedIn() {
    return !!this.creds.jwt;
  },
  async validateCode() {
    const code = this.state.code.trim();
    if (!code) {
      this.state.error = "Skriv inn ein invitasjonskode";
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.render();

    const query = `
      query ValidateInvite($code: String!) {
        validateInviteCode(pCode: $code) {
          nodes {
            meetingId
            meetingTitle
            orgName
            isValid
          }
        }
      }
    `;

    try {
      const data = await gql(query, { code }, { jwt: false });
      const result = data?.validateInviteCode?.nodes?.[0];

      this.state.loading = false;

      if (result?.isValid) {
        this.state.meetingInfo = {
          id: result.meetingId,
          title: result.meetingTitle,
          orgName: result.orgName,
        };
        this.state.step = "confirm";
      } else {
        this.state.error = "Ugyldig eller utgatt invitasjonskode";
      }
      this.render();
    } catch (error) {
      this.state.loading = false;
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      this.state.error = messages.join(". ");
      this.render();
    }
  },
  async joinMeeting() {
    if (!this.isLoggedIn()) {
      // Redirect to login with return URL
      const returnUrl = `/bli-med.html?code=${encodeURIComponent(this.state.code)}`;
      window.location.assign(`/login.html?returnTo=${encodeURIComponent(returnUrl)}`);
      return;
    }

    const displayName = this.state.displayName.trim();
    if (!displayName) {
      this.state.error = "Skriv inn namnet ditt";
      this.render();
      return;
    }

    this.state.step = "joining";
    this.state.error = null;
    this.render();

    const mutation = `
      mutation JoinMeeting($meetingId: String!, $inviteCode: String!, $displayName: String!) {
        joinMeeting(input: {pMeetingId: $meetingId, pInviteCode: $inviteCode, pDisplayName: $displayName}) {
          meetingParticipant {
            id
            meetingId
            displayName
            participantNum
          }
        }
      }
    `;

    try {
      const data = await gql(mutation, {
        meetingId: this.state.meetingInfo.id,
        inviteCode: this.state.code,
        displayName: displayName,
      });

      const participant = data?.joinMeeting?.meetingParticipant;
      if (participant) {
        this.state.step = "success";
        this.state.participant = participant;
      } else {
        this.state.step = "confirm";
        this.state.error = "Kunne ikkje bli med i motet";
      }
      this.render();
    } catch (error) {
      this.state.step = "confirm";
      const messages = error.extra?.body?.errors?.map((e) => e.message) || [error.message || "Noko gjekk gale"];
      // Translate common error messages to Norwegian
      this.state.error = messages.map((msg) => {
        if (msg.includes("already a participant")) {
          return "Du er allereie deltakar i dette motet";
        }
        if (msg.includes("Invalid invite code")) {
          return "Ugyldig invitasjonskode";
        }
        if (msg.includes("expired")) {
          return "Invitasjonskoden har gatt ut";
        }
        if (msg.includes("maximum uses")) {
          return "Invitasjonskoden er brukt opp";
        }
        if (msg.includes("must be logged in")) {
          return "Du ma vera logga inn for a bli med";
        }
        return msg;
      }).join(". ");
      this.render();
    }
  },
  goBack() {
    this.state.step = "code";
    this.state.meetingInfo = null;
    this.state.error = null;
    this.render();
  },
  onCodeSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    this.state.code = form.get("code").trim().toUpperCase();
    this.validateCode();
  },
  onJoinSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    this.state.displayName = form.get("displayName").trim();
    this.joinMeeting();
  },
  render() {
    // If user needs to log in to proceed
    if (this.state.step === "confirm" && !this.isLoggedIn()) {
      this.html`
        <div class="login-required">
          <div class="meeting-info">
            <h3>${this.state.meetingInfo?.title}</h3>
            <p>Arrangert av ${this.state.meetingInfo?.orgName}</p>
          </div>
          <p>Du ma logga inn eller registrera deg for a bli med i motet.</p>
          <a class="btn" href="/login.html?returnTo=${encodeURIComponent(`/bli-med.html?code=${this.state.code}`)}">Logg inn</a>
          <p style="margin-top: 15px">
            <a href="/registrer.html?returnTo=${encodeURIComponent(`/bli-med.html?code=${this.state.code}`)}">Registrer deg</a>
          </p>
        </div>
      `;
      return;
    }

    if (this.state.step === "success") {
      this.html`
        <div class="success">
          <h3>Du er no med i motet!</h3>
          <p>Du er registrert som <strong>${this.state.participant?.displayName}</strong> (nr. ${this.state.participant?.participantNum})</p>
          <a class="btn" href="/queue.html?id=${this.state.participant?.meetingId}">Ga til motet</a>
        </div>
      `;
      return;
    }

    if (this.state.step === "confirm" || this.state.step === "joining") {
      this.html`
        ${this.children}
        <form onsubmit=${this.onJoinSubmit.bind(this)}>
          <div class="meeting-info">
            <h3>${this.state.meetingInfo?.title}</h3>
            <p>Arrangert av ${this.state.meetingInfo?.orgName}</p>
          </div>

          <label for="displayName">Ditt namn</label>
          <input name="displayName" id="displayName" type="text" required
                 placeholder="T.d. Ola Nordmann"
                 value=${this.state.displayName}
                 disabled=${this.state.step === "joining"} />

          ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

          <input type="submit"
                 value=${this.state.step === "joining" ? "Blir med..." : "Bli med"}
                 disabled=${this.state.step === "joining"} />

          <div class="back-link">
            <a onclick=${this.goBack.bind(this)}>Bruk ein annan kode</a>
          </div>
        </form>
      `;
      return;
    }

    // Default: code entry step
    this.html`
      ${this.children}
      <form onsubmit=${this.onCodeSubmit.bind(this)}>
        <label for="code">Invitasjonskode</label>
        <input name="code" id="code" type="text" required
               class="code-input"
               placeholder="XXXXXXXX"
               maxlength="8"
               value=${this.state.code}
               disabled=${this.state.loading} />

        ${this.state.error ? html`<p class="err">${this.state.error}</p>` : ""}

        <input type="submit" value=${this.state.loading ? "Sjekkar..." : "Fortset"} disabled=${this.state.loading} />
      </form>
    `;
  },
});
