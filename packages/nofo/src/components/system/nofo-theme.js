import { NofoElement } from "../../index.js";

class NofoTheme extends NofoElement {
  static props = {
    appearance: "inherit",
    "accent-color": "blue",
    "gray-color": "slate",
    "panel-background": "solid",
    radius: "medium",
    scaling: "100%",
  };

  onMount() {
    this.sync()
      .attr("appearance")
      .toCSS("--appearance")
      .attr("accent-color")
      .toCSS("--accent-color")
      .attr("gray-color")
      .toCSS("--gray-color")
      .attr("panel-background")
      .toCSS("--panel-background", (v) =>
        v === "translucent" ? "var(--color-panel-translucent)" : "var(--color-panel-solid)",
      )
      .attr("radius")
      .toCSS("--radius", (r) => {
        const map = {
          none: "0",
          small: "0.125rem",
          medium: "0.25rem",
          large: "0.5rem",
          full: "9999px",
        };
        return map[r] || r;
      })
      .attr("scaling")
      .toCSS("--scaling");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: block; }`;
  }
}

customElements.define("nofo-theme", NofoTheme);
export { NofoTheme };
