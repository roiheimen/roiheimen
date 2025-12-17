import { define, html } from "/web_modules/heresy.js";

/**
 * Theme picker component for customizing CSS variables
 * Emits 'theme-change' event with the updated theme config
 */
define("RoiThemePicker", {
  mappedAttributes: ["config", "disabled"],
  oninit() {
    this.state = {
      expanded: false,
    };
  },
  style(self) {
    return `
    ${self} {
      display: block;
    }
    ${self} .theme-section {
      margin-bottom: 16px;
    }
    ${self} .theme-section h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }
    ${self} .theme-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    ${self} .theme-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    ${self} .theme-item label {
      font-size: 13px;
      color: #666;
    }
    ${self} .color-input-wrapper {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    ${self} input[type="color"] {
      width: 40px;
      height: 32px;
      padding: 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
    }
    ${self} input[type="color"]:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    ${self} input[type="text"].color-text {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
    ${self} input[type="text"]:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }
    ${self} input[type="text"].font-input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
    }
    ${self} select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
      background: white;
    }
    ${self} select:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }
    ${self} .preview-box {
      margin-top: 16px;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    ${self} .preview-box h3 {
      margin: 0 0 8px 0;
    }
    ${self} .preview-box p {
      margin: 0;
    }
    ${self} .reset-btn {
      margin-top: 16px;
      padding: 8px 16px;
      background: #e5e7eb;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      color: #374151;
    }
    ${self} .reset-btn:hover:not(:disabled) {
      background: #d1d5db;
    }
    ${self} .reset-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${self} .expand-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      width: 100%;
      text-align: left;
    }
    ${self} .expand-toggle:hover {
      background: #e5e7eb;
    }
    ${self} .expand-toggle .arrow {
      transition: transform 0.2s;
    }
    ${self} .expand-toggle .arrow.expanded {
      transform: rotate(90deg);
    }
    ${self} .theme-content {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }
    ${self} .theme-content.collapsed {
      display: none;
    }
    `;
  },
  getThemeConfig() {
    return this.config || {};
  },
  getThemeValue(key, defaultValue) {
    const theme = this.getThemeConfig().theme || {};
    return theme[key] || defaultValue;
  },
  // Default theme values from README
  getDefaults() {
    return {
      mainColor: "#2b2c3a",
      mainColor2: "#ffffff",
      videoBg: "#9c9fbd",
      font: "sans-serif",
      fontColor: "#333",
      headSize: "42px",
      headFont: "inherit",
      voteHeaderSize: "16pt",
      voteFontSize: "10pt",
    };
  },
  onchange(event) {
    if (this.disabled) return;

    const target = event.target;
    const name = target.dataset.theme;
    if (!name) return;

    let value = target.value;

    // For color inputs, update the paired text input
    if (target.type === "color") {
      const textInput = this.querySelector(`input[data-theme="${name}"].color-text`);
      if (textInput) textInput.value = value;
    }

    // For text inputs with color, validate and update color picker
    if (target.classList.contains("color-text")) {
      const colorInput = this.querySelector(`input[type="color"][data-theme="${name}"]`);
      if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(value)) {
        colorInput.value = value;
      }
    }

    this.emitChange();
  },
  oninput(event) {
    // Handle live color text input
    const target = event.target;
    if (target.classList.contains("color-text") && !this.disabled) {
      const name = target.dataset.theme;
      const colorInput = this.querySelector(`input[type="color"][data-theme="${name}"]`);
      if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(target.value)) {
        colorInput.value = target.value;
      }
    }
  },
  onclick(event) {
    if (event.target.classList.contains("expand-toggle")) {
      this.state.expanded = !this.state.expanded;
      this.render();
    }
    if (event.target.classList.contains("reset-btn") && !this.disabled) {
      this.resetToDefaults();
    }
  },
  resetToDefaults() {
    // Clear all theme values
    const defaults = this.getDefaults();
    const inputs = this.querySelectorAll("[data-theme]");
    inputs.forEach((input) => {
      const name = input.dataset.theme;
      if (defaults[name]) {
        input.value = defaults[name];
      }
    });
    this.emitChange();
  },
  emitChange() {
    const theme = {};
    const defaults = this.getDefaults();

    // Gather all theme values
    const inputs = this.querySelectorAll("[data-theme]");
    inputs.forEach((input) => {
      // Skip text inputs for colors (use color picker value)
      if (input.classList.contains("color-text")) return;

      const name = input.dataset.theme;
      const value = input.value?.trim();

      // Only include if different from default
      if (value && value !== defaults[name]) {
        theme[name] = value;
      }
    });

    // Emit custom event with theme config
    this.dispatchEvent(
      new CustomEvent("theme-change", {
        detail: { theme },
        bubbles: true,
      })
    );
  },
  renderColorInput(name, label, defaultValue) {
    const value = this.getThemeValue(name, defaultValue);
    const isDisabled = this.disabled;

    return html`
      <div class="theme-item">
        <label>${label}</label>
        <div class="color-input-wrapper">
          <input
            type="color"
            data-theme=${name}
            value=${value}
            disabled=${isDisabled}
          />
          <input
            type="text"
            class="color-text"
            data-theme=${name}
            value=${value}
            placeholder=${defaultValue}
            disabled=${isDisabled}
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </div>
      </div>
    `;
  },
  renderTextInput(name, label, defaultValue, placeholder) {
    const value = this.getThemeValue(name, defaultValue);
    const isDisabled = this.disabled;

    return html`
      <div class="theme-item">
        <label>${label}</label>
        <input
          type="text"
          class="font-input"
          data-theme=${name}
          value=${value}
          placeholder=${placeholder || defaultValue}
          disabled=${isDisabled}
        />
      </div>
    `;
  },
  render() {
    const defaults = this.getDefaults();
    const isDisabled = this.disabled;
    const isExpanded = this.state.expanded;

    // Preview colors
    const mainColor = this.getThemeValue("mainColor", defaults.mainColor);
    const mainColor2 = this.getThemeValue("mainColor2", defaults.mainColor2);
    const fontColor = this.getThemeValue("fontColor", defaults.fontColor);

    return this.html`
      <button class="expand-toggle" type="button" onclick=${this}>
        <span class="arrow ${isExpanded ? "expanded" : ""}">&#9654;</span>
        Tilpass utsjånad (tema)
      </button>

      <div class="theme-content ${isExpanded ? "" : "collapsed"}" onchange=${this} oninput=${this}>
        <div class="theme-section">
          <h4>Hovudfargar</h4>
          <div class="theme-grid">
            ${this.renderColorInput("mainColor", "Hovudfarge", defaults.mainColor)}
            ${this.renderColorInput("mainColor2", "Sekundarfarge", defaults.mainColor2)}
            ${this.renderColorInput("fontColor", "Tekstfarge", defaults.fontColor)}
            ${this.renderColorInput("videoBg", "Videobakgrunn", defaults.videoBg)}
          </div>
        </div>

        <div class="theme-section">
          <h4>Skrifttypar</h4>
          <div class="theme-grid">
            ${this.renderTextInput("font", "Hovudskrift", defaults.font, "sans-serif, Arial, etc.")}
            ${this.renderTextInput("headFont", "Overskriftskrift", defaults.headFont, "inherit")}
          </div>
        </div>

        <div class="theme-section">
          <h4>Storleikar</h4>
          <div class="theme-grid">
            ${this.renderTextInput("headSize", "Overskriftstorleik", defaults.headSize, "42px")}
            ${this.renderTextInput("voteHeaderSize", "Avroysting overskrift", defaults.voteHeaderSize, "16pt")}
            ${this.renderTextInput("voteFontSize", "Avroysting tekst", defaults.voteFontSize, "10pt")}
          </div>
        </div>

        <!-- Preview -->
        <div
          class="preview-box"
          style=${`background: ${mainColor}; color: ${mainColor2};`}
        >
          <h3>Forhandsvisning</h3>
          <p style=${`color: ${mainColor2};`}>Slik vil hovudfargen sjå ut</p>
        </div>

        <button
          type="button"
          class="reset-btn"
          onclick=${this}
          disabled=${isDisabled}
        >
          Nullstill til standard
        </button>
      </div>
    `;
  },
});
