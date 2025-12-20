import { define, html } from "/web_modules/heresy.js";

define("RoiMeetingCard", {
  extends: "div",
  mappedAttributes: ["meeting", "orgSlug"],
  oninit() {
    // meeting and orgSlug will be set via mapped attributes
  },
  style(self) {
    return `
    ${self} {
      display: block;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      background: white;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    ${self}:hover {
      border-color: var(--roi-primary);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    ${self} .meeting-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    ${self} h4 {
      margin: 0;
      color: var(--roi-primary);
      font-size: 16px;
      font-weight: 600;
    }
    ${self} .meeting-id {
      font-size: 12px;
      color: #888;
      font-family: monospace;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }
    ${self} .meeting-meta {
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }
    ${self} .meeting-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }
    ${self} .sak-count {
      font-size: 12px;
      color: #888;
    }
    ${self} .meeting-links {
      display: flex;
      gap: 12px;
    }
    ${self} .meeting-link {
      font-size: 13px;
      color: var(--roi-primary);
      text-decoration: none;
    }
    ${self} .meeting-link:hover {
      text-decoration: underline;
    }
    ${self} .meeting-link.secondary {
      color: #666;
    }
    `;
  },
  formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("nn-NO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },
  render() {
    const meeting = this.meeting;
    if (!meeting) {
      return this.html`<p>Lastar...</p>`;
    }

    const sakCount = meeting.saks?.totalCount || 0;
    const createdAt = this.formatDate(meeting.createdAt);

    return this.html`
      <div class="meeting-header">
        <h4>${meeting.title || meeting.id}</h4>
        <span class="meeting-id">${meeting.id}</span>
      </div>
      ${createdAt ? html`<div class="meeting-meta">Oppretta ${createdAt}</div>` : ""}
      <div class="meeting-footer">
        <span class="sak-count">
          ${sakCount === 0
            ? "Ingen saker"
            : sakCount === 1
            ? "1 sak"
            : `${sakCount} saker`}
        </span>
        <div class="meeting-links">
          <a href=${`/mote-innstillingar.html?id=${meeting.id}`} class="meeting-link secondary">Innstillingar</a>
          <a href=${`/manage.html?id=${meeting.id}`} class="meeting-link">Administrer</a>
        </div>
      </div>
    `;
  },
});
