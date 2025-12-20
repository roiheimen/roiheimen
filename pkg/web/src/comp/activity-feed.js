import { define, html } from "/web_modules/heresy.js";

import storage from "../lib/storage.js";
import { gql } from "../lib/graphql.js";

// Activity type icons (simple SVG icons)
const icons = {
  org_created: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>`,
  org_joined: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,
  meeting_created: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <path d="M12 14v4M10 16h4"/>
  </svg>`,
  meeting_joined: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <polyline points="9 16 12 13 15 16"/>
  </svg>`,
};

// Format relative time in Norwegian
function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Akkurat no";
  if (diffMins < 60) return `${diffMins} min sidan`;
  if (diffHours < 24) return `${diffHours} t sidan`;
  if (diffDays < 7) return `${diffDays} d sidan`;

  // Format as date for older items
  return date.toLocaleDateString("nn-NO", {
    day: "numeric",
    month: "short",
  });
}

define("RoiActivityFeed", {
  oninit() {
    this.creds = storage("creds");
    this.state = {
      loading: true,
      activities: [],
      error: null,
    };
    this.loadActivity();
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .activity-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ${self} .activity-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    ${self} .activity-item:last-child {
      border-bottom: none;
    }
    ${self} .activity-icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      padding: 6px;
      background: #f3f4f6;
      border-radius: 50%;
      color: #6b7280;
    }
    ${self} .activity-icon svg {
      width: 100%;
      height: 100%;
    }
    ${self} .activity-icon.org_created {
      background: #dbeafe;
      color: #2563eb;
    }
    ${self} .activity-icon.org_joined {
      background: #dcfce7;
      color: #16a34a;
    }
    ${self} .activity-icon.meeting_created {
      background: #fef3c7;
      color: #d97706;
    }
    ${self} .activity-icon.meeting_joined {
      background: #f3e8ff;
      color: #9333ea;
    }
    ${self} .activity-content {
      flex: 1;
      min-width: 0;
    }
    ${self} .activity-title {
      font-weight: 500;
      color: #111;
      margin: 0 0 2px 0;
      font-size: 14px;
    }
    ${self} .activity-title a {
      color: inherit;
      text-decoration: none;
    }
    ${self} .activity-title a:hover {
      color: var(--roi-primary);
    }
    ${self} .activity-desc {
      color: #6b7280;
      font-size: 13px;
      margin: 0;
    }
    ${self} .activity-time {
      flex-shrink: 0;
      color: #9ca3af;
      font-size: 12px;
    }
    ${self} .empty {
      color: #6b7280;
      font-size: 14px;
      padding: 20px 0;
      text-align: center;
    }
    ${self} .loading {
      color: #6b7280;
      font-size: 14px;
      padding: 20px 0;
      text-align: center;
    }
    ${self} .error {
      color: #dc2626;
      font-size: 14px;
      padding: 12px;
      background: #fef2f2;
      border-radius: 4px;
    }
    `;
  },
  async loadActivity() {
    if (!this.creds.jwt) {
      this.state.loading = false;
      this.render();
      return;
    }

    try {
      const query = `
        mutation GetUserActivity($limit: Int) {
          getUserActivity(input: { activityLimit: $limit }) {
            activityItems {
              activityType
              activityTitle
              activityDescription
              activityTimestamp
              orgSlug
              meetingId
            }
          }
        }
      `;

      const result = await gql(query, { limit: 10 }, { jwt: this.creds.jwt });
      this.state.activities = result.getUserActivity?.activityItems || [];
      this.state.loading = false;
    } catch (err) {
      console.error("Activity feed error:", err);
      this.state.error = err.message || "Kunne ikkje lasta aktivitet";
      this.state.loading = false;
    }
    this.render();
  },
  getActivityLink(item) {
    if (item.meetingId && item.orgSlug) {
      return `/mote-innstillingar.html?meeting=${item.meetingId}&org=${item.orgSlug}`;
    }
    if (item.orgSlug) {
      return `/org-innstillingar.html?slug=${item.orgSlug}`;
    }
    return null;
  },
  render() {
    const { loading, activities, error } = this.state;

    if (loading) {
      return this.html`<p class="loading">Lastar aktivitet...</p>`;
    }

    if (error) {
      return this.html`<p class="error">${error}</p>`;
    }

    if (activities.length === 0) {
      return this.html`<p class="empty">Ingen aktivitet enno. Opprett ein organisasjon for a koma i gang!</p>`;
    }

    return this.html`
      <ul class="activity-list">
        ${activities.map((item) => {
          const link = this.getActivityLink(item);
          const icon = icons[item.activityType] || icons.org_created;
          return html`
            <li class="activity-item">
              <div class=${"activity-icon " + item.activityType} .innerHTML=${icon}></div>
              <div class="activity-content">
                <p class="activity-title">
                  ${link
                    ? html`<a href=${link}>${item.activityTitle}</a>`
                    : item.activityTitle}
                </p>
                <p class="activity-desc">${item.activityDescription}</p>
              </div>
              <span class="activity-time">${formatRelativeTime(item.activityTimestamp)}</span>
            </li>
          `;
        })}
      </ul>
    `;
  },
});
