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
      accent: "#ff6b35",
      accentLight: "#ff8c5a",
      accentDark: "#e55a25",
    },
    dark: {
      primary: "#4a4b5f",
      primaryLight: "#5e5f78",
      primaryDark: "#2b2c3a",
      bgBody: "#1a1b26",
      bgSurface: "#2b2c3a",
      bgElevated: "#3d3e50",
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
      accent: "#3b82f6",
      accentLight: "#60a5fa",
      accentDark: "#2563eb",
    },
    dark: {
      primary: "#3b82f6",
      primaryLight: "#60a5fa",
      primaryDark: "#1e40af",
      bgBody: "#0f172a",
      bgSurface: "#1e293b",
      bgElevated: "#334155",
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
      accent: "#10b981",
      accentLight: "#34d399",
      accentDark: "#059669",
    },
    dark: {
      primary: "#22c55e",
      primaryLight: "#4ade80",
      primaryDark: "#16a34a",
      bgBody: "#0a1f0a",
      bgSurface: "#14532d",
      bgElevated: "#166534",
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
      accent: "#a855f7",
      accentLight: "#c084fc",
      accentDark: "#9333ea",
    },
    dark: {
      primary: "#a855f7",
      primaryLight: "#c084fc",
      primaryDark: "#7e22ce",
      bgBody: "#1a0a2e",
      bgSurface: "#2e1065",
      bgElevated: "#4c1d95",
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
      accent: "#14b8a6",
      accentLight: "#5eead4",
      accentDark: "#0d9488",
    },
    dark: {
      primary: "#14b8a6",
      primaryLight: "#2dd4bf",
      primaryDark: "#0f766e",
      bgBody: "#042f2e",
      bgSurface: "#134e4a",
      bgElevated: "#115e59",
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
      accent: "#ef4444",
      accentLight: "#f87171",
      accentDark: "#dc2626",
    },
    dark: {
      primary: "#ef4444",
      primaryLight: "#f87171",
      primaryDark: "#dc2626",
      bgBody: "#1a0a0a",
      bgSurface: "#450a0a",
      bgElevated: "#7f1d1d",
    },
  },
};

/**
 * Apply a color scheme to the document
 */
export function applyColorScheme(schemeKey, mode = "light") {
  const scheme = colorSchemes[schemeKey];
  if (!scheme) {
    console.error(`Unknown color scheme: ${schemeKey}`);
    return;
  }

  const colors = mode === "dark" ? scheme.dark : scheme.light;
  const root = document.documentElement;

  // Apply colors
  Object.entries(colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variables
    const cssVar = `--roi-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });

  // Store current scheme in localStorage
  localStorage.setItem("roiColorScheme", schemeKey);
  localStorage.setItem("roiColorMode", mode);

  console.log(`✓ Applied color scheme: ${scheme.name} (${mode} mode)`);
}

/**
 * Toggle between light and dark mode
 */
export function toggleDarkMode() {
  const root = document.documentElement;
  const currentMode = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

  if (currentMode === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark-mode");
  } else {
    root.removeAttribute("data-theme");
    root.classList.remove("dark-mode");
  }

  // Reapply the current color scheme in the new mode
  const currentScheme = localStorage.getItem("roiColorScheme") || "default";
  applyColorScheme(currentScheme, currentMode);

  console.log(`✓ Switched to ${currentMode} mode`);
  return currentMode;
}

/**
 * Get the current color scheme and mode
 */
export function getCurrentScheme() {
  const scheme = localStorage.getItem("roiColorScheme") || "default";
  const mode = localStorage.getItem("roiColorMode") || "light";
  const root = document.documentElement;
  const actualMode = root.getAttribute("data-theme") === "dark" ? "dark" : "light";

  return {
    scheme,
    mode: actualMode,
    storedMode: mode,
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

  // Clear all custom color variables
  const root = document.documentElement;
  const customVars = [
    "primary",
    "primary-light",
    "primary-dark",
    "accent",
    "accent-light",
    "accent-dark",
    "bg-body",
    "bg-surface",
    "bg-elevated",
  ];

  customVars.forEach((varName) => {
    root.style.removeProperty(`--roi-${varName}`);
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
        background: var(--roi-bg-surface);
        border: 2px solid var(--roi-border-medium);
        border-radius: var(--roi-radius-lg);
        padding: var(--roi-space-lg);
        box-shadow: var(--roi-shadow-xl);
        z-index: 9999;
        font-family: var(--roi-font-sans);
        min-width: 280px;
        max-width: 320px;
      }
      #roi-color-scheme-picker h3 {
        margin: 0 0 var(--roi-space-md) 0;
        font-size: var(--roi-text-lg);
        color: var(--roi-text-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #roi-color-scheme-picker .close-btn {
        background: none;
        border: none;
        font-size: var(--roi-text-2xl);
        cursor: pointer;
        padding: 0;
        color: var(--roi-text-secondary);
        line-height: 1;
      }
      #roi-color-scheme-picker .close-btn:hover {
        color: var(--roi-text-primary);
      }
      #roi-color-scheme-picker .scheme-grid {
        display: grid;
        gap: var(--roi-space-sm);
        margin-bottom: var(--roi-space-md);
      }
      #roi-color-scheme-picker button.scheme-btn {
        padding: var(--roi-space-sm) var(--roi-space-md);
        background: var(--roi-bg-elevated);
        border: 2px solid var(--roi-border-medium);
        border-radius: var(--roi-radius-md);
        cursor: pointer;
        font-size: var(--roi-text-sm);
        color: var(--roi-text-primary);
        text-align: left;
        transition: all var(--roi-transition-fast);
      }
      #roi-color-scheme-picker button.scheme-btn:hover {
        border-color: var(--roi-primary);
        background: var(--roi-bg-body);
      }
      #roi-color-scheme-picker button.scheme-btn.active {
        border-color: var(--roi-primary);
        background: var(--roi-primary);
        color: var(--roi-text-inverse);
        font-weight: var(--roi-weight-semibold);
      }
      #roi-color-scheme-picker .scheme-btn .name {
        font-weight: var(--roi-weight-semibold);
        display: block;
      }
      #roi-color-scheme-picker .scheme-btn .desc {
        font-size: var(--roi-text-xs);
        opacity: 0.8;
        display: block;
        margin-top: 2px;
      }
      #roi-color-scheme-picker .controls {
        display: flex;
        gap: var(--roi-space-sm);
        padding-top: var(--roi-space-md);
        border-top: 1px solid var(--roi-border-light);
      }
      #roi-color-scheme-picker .controls button {
        flex: 1;
        padding: var(--roi-space-sm);
        border-radius: var(--roi-radius-md);
        cursor: pointer;
        font-size: var(--roi-text-sm);
        border: 1px solid var(--roi-border-medium);
        transition: all var(--roi-transition-fast);
      }
      #roi-color-scheme-picker .dark-mode-btn {
        background: var(--roi-bg-elevated);
        color: var(--roi-text-primary);
      }
      #roi-color-scheme-picker .dark-mode-btn:hover {
        background: var(--roi-primary);
        color: var(--roi-text-inverse);
      }
      #roi-color-scheme-picker .reset-btn {
        background: var(--roi-gray-200);
        color: var(--roi-text-primary);
      }
      #roi-color-scheme-picker .reset-btn:hover {
        background: var(--roi-error);
        color: var(--roi-text-inverse);
      }
      #roi-color-scheme-picker .info {
        margin-top: var(--roi-space-md);
        padding: var(--roi-space-sm);
        background: var(--roi-info-bg);
        border-radius: var(--roi-radius-sm);
        font-size: var(--roi-text-xs);
        color: var(--roi-info);
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
      applyColorScheme(btn.dataset.scheme, currentScheme.mode);
    });
  });

  picker.querySelector(".dark-mode-btn").addEventListener("click", () => {
    const newMode = toggleDarkMode();
    picker.querySelector(".dark-mode-btn").textContent =
      newMode === "dark" ? "☀️ Lys modus" : "🌙 Mørk modus";
  });

  picker.querySelector(".reset-btn").addEventListener("click", () => {
    picker.querySelectorAll(".scheme-btn").forEach((b) => b.classList.remove("active"));
    picker.querySelector('[data-scheme="default"]').classList.add("active");
    resetToDefault();
    picker.querySelector(".dark-mode-btn").textContent = "🌙 Mørk modus";
  });

  // Update dark mode button text based on current mode
  if (currentScheme.mode === "dark") {
    picker.querySelector(".dark-mode-btn").textContent = "☀️ Lys modus";
  }

  console.log("✓ Color scheme picker displayed");
}

/**
 * Initialize color schemes on page load
 */
export function initColorSchemes() {
  const savedScheme = localStorage.getItem("roiColorScheme");
  const savedMode = localStorage.getItem("roiColorMode");

  if (savedScheme) {
    applyColorScheme(savedScheme, savedMode || "light");

    // Apply dark mode class if needed
    if (savedMode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark-mode");
    }
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
