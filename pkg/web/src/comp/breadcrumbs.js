import { define, html } from "/web_modules/heresy.js";

/**
 * Breadcrumb Navigation Component
 *
 * Provides hierarchical navigation breadcrumbs for contextual navigation.
 *
 * Usage:
 * <roi-breadcrumbs .items=${[
 *   { label: "Oversikt", href: "/oversikt.html" },
 *   { label: "Min Organisasjon", href: "/org-innstillingar.html?slug=min-org" },
 *   { label: "Innstillingar" }
 * ]}></roi-breadcrumbs>
 *
 * The last item should not have href (current page).
 */
define("RoiBreadcrumbs", {
  style(self) {
    return `
    ${self} {
      display: block;
      margin-bottom: 20px;
    }
    ${self} nav {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      font-size: 14px;
    }
    ${self} .breadcrumb-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    ${self} .breadcrumb-item a {
      color: var(--roi-primary);
      text-decoration: none;
    }
    ${self} .breadcrumb-item a:hover {
      text-decoration: underline;
    }
    ${self} .breadcrumb-item span {
      color: #666;
    }
    ${self} .breadcrumb-separator {
      color: #999;
      margin: 0 4px;
    }
    ${self} .breadcrumb-current {
      color: #333;
      font-weight: 500;
    }
    ${self} .breadcrumb-icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
      vertical-align: middle;
      margin-right: 4px;
    }
    `;
  },
  render({ items = [] }) {
    // Home icon SVG
    const homeIcon = html`
      <svg class="breadcrumb-icon" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    `;

    // Separator
    const separator = html`<span class="breadcrumb-separator">/</span>`;

    return this.html`
      <nav aria-label="Brødsmulesti">
        ${items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          if (isLast) {
            // Current page - no link
            return html`
              <span class="breadcrumb-item">
                ${index > 0 ? separator : ""}
                <span class="breadcrumb-current">${item.label}</span>
              </span>
            `;
          }

          return html`
            <span class="breadcrumb-item">
              ${index > 0 ? separator : ""}
              <a href=${item.href}>
                ${isFirst ? homeIcon : ""}${item.label}
              </a>
            </span>
          `;
        })}
      </nav>
    `;
  },
});
