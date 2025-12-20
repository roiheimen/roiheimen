/**
 * Color Scheme Presets for Roiheimen
 *
 * This module provides preset color schemes and utilities to switch between them.
 * Accessible via window.roiColorSchemes for easy testing.
 */

export const colorSchemes = {
  // Default theme (current colors)
  default: {
    name: "Standard",
    description: "Standard Roiheimen fargepalett",
    light: {
      primary: "#2b2c3a",
      primaryLight: "#3d3e50",
      primaryDark: "#1a1b26",
      secondary: "#9c9fbd",
      accent: "#ff6b35",
      accentLight: "#ff8c5a",
      accentDark: "#e55a25",
      bgBody: "#fefbf8",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#333333",
      textSecondary: "#666666",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#6b6d8a",
      primaryLight: "#8b8daa",
      primaryDark: "#4a4b5f",
      secondary: "#9c9fbd",
      accent: "#ff8c5a",
      accentLight: "#ffab85",
      accentDark: "#ff6b35",
      bgBody: "#1a1b26",
      bgSurface: "#2b2c3a",
      bgElevated: "#3d3e50",
      textPrimary: "#e5e5e5",
      textSecondary: "#b8b8b8",
      textInverse: "#1a1b26",
    },
  },

  // Blue theme
  blue: {
    name: "Blå",
    description: "Profesjonell blå fargepalett",
    light: {
      primary: "#1e3a8a",
      primaryLight: "#3b82f6",
      primaryDark: "#1e40af",
      secondary: "#64748b",
      accent: "#3b82f6",
      accentLight: "#60a5fa",
      accentDark: "#2563eb",
      bgBody: "#f8fafc",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#1e293b",
      textSecondary: "#475569",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#60a5fa",
      primaryLight: "#93c5fd",
      primaryDark: "#3b82f6",
      secondary: "#94a3b8",
      accent: "#60a5fa",
      accentLight: "#93c5fd",
      accentDark: "#3b82f6",
      bgBody: "#0f172a",
      bgSurface: "#1e293b",
      bgElevated: "#334155",
      textPrimary: "#f1f5f9",
      textSecondary: "#cbd5e1",
      textInverse: "#0f172a",
    },
  },

  // Green theme
  green: {
    name: "Grøn",
    description: "Frisk grøn fargepalett",
    light: {
      primary: "#15803d",
      primaryLight: "#22c55e",
      primaryDark: "#166534",
      secondary: "#6b7280",
      accent: "#10b981",
      accentLight: "#34d399",
      accentDark: "#059669",
      bgBody: "#f0fdf4",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#14532d",
      textSecondary: "#166534",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#4ade80",
      primaryLight: "#86efac",
      primaryDark: "#22c55e",
      secondary: "#9ca3af",
      accent: "#34d399",
      accentLight: "#6ee7b7",
      accentDark: "#10b981",
      bgBody: "#052e16",
      bgSurface: "#14532d",
      bgElevated: "#166534",
      textPrimary: "#dcfce7",
      textSecondary: "#bbf7d0",
      textInverse: "#052e16",
    },
  },

  // Purple theme
  purple: {
    name: "Lilla",
    description: "Kreativ lilla fargepalett",
    light: {
      primary: "#7c3aed",
      primaryLight: "#a78bfa",
      primaryDark: "#6d28d9",
      secondary: "#6b7280",
      accent: "#a855f7",
      accentLight: "#c084fc",
      accentDark: "#9333ea",
      bgBody: "#faf5ff",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#3b0764",
      textSecondary: "#581c87",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#c084fc",
      primaryLight: "#d8b4fe",
      primaryDark: "#a855f7",
      secondary: "#9ca3af",
      accent: "#c084fc",
      accentLight: "#d8b4fe",
      accentDark: "#a855f7",
      bgBody: "#1a0a2e",
      bgSurface: "#2e1065",
      bgElevated: "#4c1d95",
      textPrimary: "#f3e8ff",
      textSecondary: "#e9d5ff",
      textInverse: "#1a0a2e",
    },
  },

  // Teal theme
  teal: {
    name: "Turkis",
    description: "Moderne turkis fargepalett",
    light: {
      primary: "#0f766e",
      primaryLight: "#14b8a6",
      primaryDark: "#115e59",
      secondary: "#6b7280",
      accent: "#14b8a6",
      accentLight: "#5eead4",
      accentDark: "#0d9488",
      bgBody: "#f0fdfa",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#134e4a",
      textSecondary: "#115e59",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#5eead4",
      primaryLight: "#99f6e4",
      primaryDark: "#2dd4bf",
      secondary: "#9ca3af",
      accent: "#5eead4",
      accentLight: "#99f6e4",
      accentDark: "#2dd4bf",
      bgBody: "#042f2e",
      bgSurface: "#134e4a",
      bgElevated: "#115e59",
      textPrimary: "#ccfbf1",
      textSecondary: "#99f6e4",
      textInverse: "#042f2e",
    },
  },

  // Red theme
  red: {
    name: "Raud",
    description: "Energisk raud fargepalett",
    light: {
      primary: "#b91c1c",
      primaryLight: "#ef4444",
      primaryDark: "#991b1b",
      secondary: "#6b7280",
      accent: "#ef4444",
      accentLight: "#f87171",
      accentDark: "#dc2626",
      bgBody: "#fef2f2",
      bgSurface: "#ffffff",
      bgElevated: "#ffffff",
      textPrimary: "#450a0a",
      textSecondary: "#7f1d1d",
      textInverse: "#ffffff",
    },
    dark: {
      primary: "#f87171",
      primaryLight: "#fca5a5",
      primaryDark: "#ef4444",
      secondary: "#9ca3af",
      accent: "#f87171",
      accentLight: "#fca5a5",
      accentDark: "#ef4444",
      bgBody: "#1a0a0a",
      bgSurface: "#450a0a",
      bgElevated: "#7f1d1d",
      textPrimary: "#fef2f2",
      textSecondary: "#fecaca",
      textInverse: "#1a0a0a",
    },
  },
};

/**
 * Get current mode (light/dark) from DOM
 */
function getCurrentMode() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Notify all same-origin iframes to update their theme
 */
function notifyIframes() {
  document.querySelectorAll("iframe").forEach((iframe) => {
    try {
      if (iframe.contentWindow?.roiColorSchemes?.init) {
        iframe.contentWindow.roiColorSchemes.init();
      }
    } catch (e) {
      // Cross-origin iframe, ignore
    }
  });
}

/**
 * Apply a color scheme to the document
 */
export function applyColorScheme(schemeKey, mode = null) {
  const scheme = colorSchemes[schemeKey];
  if (!scheme) {
    console.error(`Unknown color scheme: ${schemeKey}`);
    return;
  }

  // Use provided mode or detect from current state
  const actualMode = mode || getCurrentMode();
  const colors = actualMode === "dark" ? scheme.dark : scheme.light;
  const root = document.documentElement;

  // Apply all color variables
  const colorMapping = {
    primary: "--roi-primary",
    primaryLight: "--roi-primary-light",
    primaryDark: "--roi-primary-dark",
    secondary: "--roi-secondary",
    accent: "--roi-accent",
    accentLight: "--roi-accent-light",
    accentDark: "--roi-accent-dark",
    bgBody: "--roi-bg-body",
    bgSurface: "--roi-bg-surface",
    bgElevated: "--roi-bg-elevated",
    textPrimary: "--roi-text-primary",
    textSecondary: "--roi-text-secondary",
    textInverse: "--roi-text-inverse",
  };

  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = colorMapping[key];
    if (cssVar) {
      root.style.setProperty(cssVar, value);
    }
  });

  // Store current scheme in localStorage
  localStorage.setItem("roiColorScheme", schemeKey);
  localStorage.setItem("roiColorMode", actualMode);

  // Notify iframes to update their theme
  notifyIframes();

  console.log(`✓ Applied color scheme: ${scheme.name} (${actualMode} mode)`);
}

/**
 * Toggle between light and dark mode
 */
export function toggleDarkMode() {
  const root = document.documentElement;
  const newMode = getCurrentMode() === "dark" ? "light" : "dark";

  // Set/remove dark mode attributes
  if (newMode === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark-mode");
  } else {
    root.removeAttribute("data-theme");
    root.classList.remove("dark-mode");
  }

  // Reapply the current color scheme in the new mode
  const currentScheme = localStorage.getItem("roiColorScheme") || "default";
  applyColorScheme(currentScheme, newMode);

  console.log(`✓ Switched to ${newMode} mode`);
  return newMode;
}

/**
 * Get the current color scheme and mode
 */
export function getCurrentScheme() {
  const scheme = localStorage.getItem("roiColorScheme") || "default";
  const mode = getCurrentMode();

  return {
    scheme,
    mode,
    storedMode: localStorage.getItem("roiColorMode") || "light",
  };
}

/**
 * Reset to default color scheme
 */
export function resetToDefault() {
  localStorage.removeItem("roiColorScheme");
  localStorage.removeItem("roiColorMode");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark-mode");

  // Clear all custom color variables to fall back to CSS defaults
  const root = document.documentElement;
  const varsToReset = [
    "--roi-primary",
    "--roi-primary-light",
    "--roi-primary-dark",
    "--roi-secondary",
    "--roi-accent",
    "--roi-accent-light",
    "--roi-accent-dark",
    "--roi-bg-body",
    "--roi-bg-surface",
    "--roi-bg-elevated",
    "--roi-text-primary",
    "--roi-text-secondary",
    "--roi-text-inverse",
  ];

  varsToReset.forEach((varName) => {
    root.style.removeProperty(varName);
  });

  console.log("✓ Reset to default color scheme");
}

/**
 * Create a simple UI for testing color schemes
 */
export function showColorSchemePicker() {
  const existingPicker = document.getElementById("roi-color-scheme-picker");
  if (existingPicker) {
    existingPicker.remove();
    return;
  }

  const picker = document.createElement("div");
  picker.id = "roi-color-scheme-picker";
  picker.innerHTML = `
    <style>
      #roi-color-scheme-picker {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--roi-bg-surface, #fff);
        border: 2px solid var(--roi-border-medium, #ddd);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 9999;
        font-family: system-ui, sans-serif;
        min-width: 280px;
        max-width: 320px;
        color: var(--roi-text-primary, #333);
      }
      #roi-color-scheme-picker h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #roi-color-scheme-picker .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        color: var(--roi-text-secondary, #666);
        line-height: 1;
      }
      #roi-color-scheme-picker .close-btn:hover {
        color: var(--roi-text-primary, #333);
      }
      #roi-color-scheme-picker .scheme-grid {
        display: grid;
        gap: 8px;
        margin-bottom: 12px;
      }
      #roi-color-scheme-picker button.scheme-btn {
        padding: 8px 12px;
        background: var(--roi-bg-elevated, #f5f5f5);
        border: 2px solid var(--roi-border-medium, #ddd);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        color: var(--roi-text-primary, #333);
        text-align: left;
        transition: all 0.15s ease;
      }
      #roi-color-scheme-picker button.scheme-btn:hover {
        border-color: var(--roi-primary, #2b2c3a);
        background: var(--roi-bg-body, #fefbf8);
      }
      #roi-color-scheme-picker button.scheme-btn.active {
        border-color: var(--roi-primary-dark, #1a1b26);
        background: var(--roi-primary-dark, #1a1b26);
        color: #ffffff;
        font-weight: 600;
      }
      #roi-color-scheme-picker .scheme-btn .name {
        font-weight: 600;
        display: block;
      }
      #roi-color-scheme-picker .scheme-btn .desc {
        font-size: 12px;
        opacity: 0.8;
        display: block;
        margin-top: 2px;
      }
      #roi-color-scheme-picker .controls {
        display: flex;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid var(--roi-border-light, #e6e6e6);
      }
      #roi-color-scheme-picker .controls button {
        flex: 1;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        border: 1px solid var(--roi-border-medium, #ddd);
        transition: all 0.15s ease;
      }
      #roi-color-scheme-picker .dark-mode-btn {
        background: var(--roi-bg-elevated, #f5f5f5);
        color: var(--roi-text-primary, #333);
      }
      #roi-color-scheme-picker .dark-mode-btn:hover {
        background: var(--roi-primary, #2b2c3a);
        color: var(--roi-text-inverse, #fff);
      }
      #roi-color-scheme-picker .reset-btn {
        background: var(--roi-bg-elevated, #e5e5e5);
        color: var(--roi-text-secondary, #666);
        border-color: var(--roi-border-medium, #ddd);
      }
      #roi-color-scheme-picker .reset-btn:hover {
        background: var(--roi-error, #ef4444);
        color: #ffffff;
        border-color: var(--roi-error, #ef4444);
      }
      #roi-color-scheme-picker .info {
        margin-top: 12px;
        padding: 8px;
        background: var(--roi-bg-elevated, #f0f7ff);
        border: 1px solid var(--roi-border-light, #e6e6e6);
        border-radius: 6px;
        font-size: 12px;
        color: var(--roi-text-secondary, #666);
        line-height: 1.4;
      }
    </style>
    <h3>
      Fargepalettar
      <button class="close-btn" onclick="this.closest('#roi-color-scheme-picker').remove()">×</button>
    </h3>
    <div class="scheme-grid">
      ${Object.entries(colorSchemes)
        .map(
          ([key, scheme]) => `
        <button class="scheme-btn" data-scheme="${key}">
          <span class="name">${scheme.name}</span>
          <span class="desc">${scheme.description}</span>
        </button>
      `
        )
        .join("")}
    </div>
    <div class="controls">
      <button class="dark-mode-btn">🌙 Mørk modus</button>
      <button class="reset-btn">↻ Nullstill</button>
    </div>
    <div class="info">
      💡 Test ulike fargepalettar. Berre standardpaletten er inkludert på gratisversjonen.
    </div>
  `;

  document.body.appendChild(picker);

  // Add event listeners
  const currentScheme = getCurrentScheme();

  // Highlight current scheme
  picker.querySelectorAll(".scheme-btn").forEach((btn) => {
    if (btn.dataset.scheme === currentScheme.scheme) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      picker.querySelectorAll(".scheme-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyColorScheme(btn.dataset.scheme);
    });
  });

  // Update dark mode button based on current state
  const updateDarkModeBtn = () => {
    const isDark = getCurrentMode() === "dark";
    picker.querySelector(".dark-mode-btn").textContent = isDark ? "☀️ Lys modus" : "🌙 Mørk modus";
  };
  updateDarkModeBtn();

  picker.querySelector(".dark-mode-btn").addEventListener("click", () => {
    toggleDarkMode();
    updateDarkModeBtn();
  });

  picker.querySelector(".reset-btn").addEventListener("click", () => {
    picker.querySelectorAll(".scheme-btn").forEach((b) => b.classList.remove("active"));
    picker.querySelector('[data-scheme="default"]').classList.add("active");
    resetToDefault();
    updateDarkModeBtn();
  });

  console.log("✓ Color scheme picker displayed");
}

/**
 * Initialize color schemes on page load
 */
export function initColorSchemes() {
  const savedScheme = localStorage.getItem("roiColorScheme");
  const savedMode = localStorage.getItem("roiColorMode");

  // Apply or remove dark mode class based on saved mode
  if (savedMode === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark-mode");
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark-mode");
  }

  // Apply saved scheme if exists
  if (savedScheme && colorSchemes[savedScheme]) {
    applyColorScheme(savedScheme, savedMode || "light");
  }
}

// Make available globally for testing
if (typeof window !== "undefined") {
  window.roiColorSchemes = {
    schemes: colorSchemes,
    apply: applyColorScheme,
    toggle: toggleDarkMode,
    current: getCurrentScheme,
    reset: resetToDefault,
    show: showColorSchemePicker,
    init: initColorSchemes,
  };

  console.log("💡 Color schemes ready! Use window.roiColorSchemes.show() to test");
}
