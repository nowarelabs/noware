import { NofoElement } from "../../index.js";

class NofoUITheme extends NofoElement {
  static props = {
    appearance: "nofo",
    accentColor: "green",
    radius: "medium",
  };

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: contents;
        box-sizing: border-box;
      }
    `;
  }

  onMount() {
    this.sync(() => this.updateTheme());
    this.updateTheme();
  }

  updateTheme() {
    const appearance = this.state.appearance || "nofo";
    const accentColor = this.state.accentColor || "green";
    const radius = this.state.radius || "medium";

    const theme = this.getTheme(appearance, accentColor, radius);

    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--nofo-ui-${key}`, value);
    });
  }

  getTheme(appearance, accentColor, radius) {
    const accentColors = {
      green: {
        primary: "#00ff41",
        secondary: "#00cc33",
        tertiary: "#009926",
        muted: "#00ff4120",
        accent: "#00ff41",
        foreground: "#ffffff",
      },
      cyan: {
        primary: "#00ffff",
        secondary: "#00cccc",
        tertiary: "#009999",
        muted: "#00ffff20",
        accent: "#00ffff",
        foreground: "#ffffff",
      },
      blue: {
        primary: "#0066ff",
        secondary: "#0052cc",
        tertiary: "#003d99",
        muted: "#0066ff20",
        accent: "#0066ff",
        foreground: "#ffffff",
      },
      purple: {
        primary: "#9966ff",
        secondary: "#7a52cc",
        tertiary: "#5c3d99",
        muted: "#9966ff20",
        accent: "#9966ff",
        foreground: "#ffffff",
      },
      red: {
        primary: "#ff0033",
        secondary: "#cc0026",
        tertiary: "#99001a",
        muted: "#ff003320",
        accent: "#ff0033",
        foreground: "#ffffff",
      },
    };

    const accents = accentColors[accentColor] || accentColors.green;

    const themes = {
      nofo: {
        background: "#0a0a0a",
        "background-secondary": "#111111",
        "background-tertiary": "#1a1a1a",
        foreground: "#ffffff",
        "foreground-secondary": "#cccccc",
        "foreground-tertiary": "#999999",

        border: "#00ff4133",
        "border-secondary": "#00ff4120",
        "border-tertiary": "#00ff4110",

        ...Object.fromEntries(
          Object.entries(accents).map(([key, value]) => [`accent-${key}`, value]),
        ),

        destructive: "#ff0033",
        "destructive-foreground": "#ffffff",
        warning: "#ffaa00",
        "warning-foreground": "#000000",
        success: "#00ff41",
        "success-foreground": "#000000",
        info: "#0066ff",
        "info-foreground": "#ffffff",

        hover: "#ffffff08",
        active: "#ffffff12",
        focus: "#00ff4140",
        disabled: "#333333",
        "disabled-foreground": "#666666",

        shadow: "0 2px 8px rgba(0, 255, 65, 0.1)",
        "shadow-lg": "0 8px 24px rgba(0, 255, 65, 0.15)",
        "shadow-xl": "0 16px 48px rgba(0, 255, 65, 0.2)",

        spacing: "0.5rem",
        "spacing-sm": "0.25rem",
        "spacing-md": "0.75rem",
        "spacing-lg": "1rem",
        "spacing-xl": "1.5rem",

        radius:
          radius === "none"
            ? "0"
            : radius === "small"
              ? "0.25rem"
              : radius === "medium"
                ? "0.5rem"
                : radius === "large"
                  ? "0.75rem"
                  : radius === "full"
                    ? "9999px"
                    : "0.5rem",

        "font-family": '"JetBrains Mono", "Fira Code", "Consolas", monospace',
        "font-size-xs": "0.75rem",
        "font-size-sm": "0.875rem",
        "font-size-base": "1rem",
        "font-size-lg": "1.125rem",
        "font-size-xl": "1.25rem",

        "z-dropdown": "1000",
        "z-sticky": "1020",
        "z-fixed": "1030",
        "z-modal-backdrop": "1040",
        "z-modal": "1050",
        "z-popover": "1060",
        "z-tooltip": "1070",
      },
      dark: {
        background: "#0d1117",
        "background-secondary": "#161b22",
        "background-tertiary": "#21262d",
        foreground: "#f0f6fc",
        "foreground-secondary": "#c9d1d9",
        "foreground-tertiary": "#8b949e",
        border: "#30363d",
        "border-secondary": "#21262d",
        "border-tertiary": "#161b22",
        ...Object.fromEntries(
          Object.entries(accents).map(([key, value]) => [`accent-${key}`, value]),
        ),
        destructive: "#f85149",
        "destructive-foreground": "#ffffff",
        warning: "#d29922",
        "warning-foreground": "#000000",
        success: "#3fb950",
        "success-foreground": "#000000",
        info: "#58a6ff",
        "info-foreground": "#ffffff",
        hover: "#ffffff08",
        active: "#ffffff12",
        focus: `${accents.accent}40`,
        disabled: "#484f58",
        "disabled-foreground": "#6e7681",
        shadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
        "shadow-lg": "0 8px 24px rgba(0, 0, 0, 0.3)",
        "shadow-xl": "0 16px 48px rgba(0, 0, 0, 0.4)",
        spacing: "0.5rem",
        "spacing-sm": "0.25rem",
        "spacing-md": "0.75rem",
        "spacing-lg": "1rem",
        "spacing-xl": "1.5rem",
        radius:
          radius === "none"
            ? "0"
            : radius === "small"
              ? "0.25rem"
              : radius === "medium"
                ? "0.5rem"
                : radius === "large"
                  ? "0.75rem"
                  : radius === "full"
                    ? "9999px"
                    : "0.5rem",
        "font-family": "system-ui, -apple-system, sans-serif",
        "font-size-xs": "0.75rem",
        "font-size-sm": "0.875rem",
        "font-size-base": "1rem",
        "font-size-lg": "1.125rem",
        "font-size-xl": "1.25rem",
        "z-dropdown": "1000",
        "z-sticky": "1020",
        "z-fixed": "1030",
        "z-modal-backdrop": "1040",
        "z-modal": "1050",
        "z-popover": "1060",
        "z-tooltip": "1070",
      },
      light: {
        background: "#ffffff",
        "background-secondary": "#f8f9fa",
        "background-tertiary": "#f1f3f5",
        foreground: "#212529",
        "foreground-secondary": "#495057",
        "foreground-tertiary": "#868e96",
        border: "#dee2e6",
        "border-secondary": "#e9ecef",
        "border-tertiary": "#f1f3f5",
        ...Object.fromEntries(
          Object.entries(accents).map(([key, value]) => [`accent-${key}`, value]),
        ),
        destructive: "#dc3545",
        "destructive-foreground": "#ffffff",
        warning: "#ffc107",
        "warning-foreground": "#000000",
        success: "#28a745",
        "success-foreground": "#ffffff",
        info: "#17a2b8",
        "info-foreground": "#ffffff",
        hover: "#00000008",
        active: "#00000012",
        focus: `${accents.accent}40`,
        disabled: "#e9ecef",
        "disabled-foreground": "#adb5bd",
        shadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        "shadow-lg": "0 8px 24px rgba(0, 0, 0, 0.15)",
        "shadow-xl": "0 16px 48px rgba(0, 0, 0, 0.2)",
        spacing: "0.5rem",
        "spacing-sm": "0.25rem",
        "spacing-md": "0.75rem",
        "spacing-lg": "1rem",
        "spacing-xl": "1.5rem",
        radius:
          radius === "none"
            ? "0"
            : radius === "small"
              ? "0.25rem"
              : radius === "medium"
                ? "0.5rem"
                : radius === "large"
                  ? "0.75rem"
                  : radius === "full"
                    ? "9999px"
                    : "0.5rem",
        "font-family": "system-ui, -apple-system, sans-serif",
        "font-size-xs": "0.75rem",
        "font-size-sm": "0.875rem",
        "font-size-base": "1rem",
        "font-size-lg": "1.125rem",
        "font-size-xl": "1.25rem",
        "z-dropdown": "1000",
        "z-sticky": "1020",
        "z-fixed": "1030",
        "z-modal-backdrop": "1040",
        "z-modal": "1050",
        "z-popover": "1060",
        "z-tooltip": "1070",
      },
    };

    return themes[appearance] || themes.nofo;
  }
}

customElements.define("nofo-ui-theme", NofoUITheme);
