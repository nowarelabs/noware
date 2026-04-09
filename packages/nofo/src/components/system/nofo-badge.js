import { NofoElement } from "../../index.js";

class NofoBadge extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    radius: "full",
    "high-contrast": false,
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("radius")
      .toDataAttr("radius")
      .attr("high-contrast")
      .toDataAttr("high-contrast");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        text-transform: uppercase;
        white-space: nowrap;
        box-sizing: border-box;
      }

      /* Sizes */
      :host([data-size="1"]) { font-size: 0.65rem; height: 1.25rem; padding: 0 0.375rem; }
      :host([data-size="2"]) { font-size: 0.75rem; height: 1.5rem; padding: 0 0.5rem; }
      :host([data-size="3"]) { font-size: 0.875rem; height: 1.75rem; padding: 0 0.625rem; }

      /* Radii */
      :host([data-radius="none"]) { border-radius: 0; }
      :host([data-radius="small"]) { border-radius: 0.125rem; }
      :host([data-radius="medium"]) { border-radius: 0.25rem; }
      :host([data-radius="large"]) { border-radius: 0.5rem; }
      :host([data-radius="full"]) { border-radius: 9999px; }

      /* Variants (Simplified for demo, usually uses CSS vars) */
      :host([data-variant="solid"]) { background: var(--accent-9); color: white; border: none; }
      :host([data-variant="soft"]) { background: var(--accent-3); color: var(--accent-11); border: none; }
      :host([data-variant="surface"]) { background: var(--color-panel-solid); color: var(--gray-11); border: 1px solid var(--gray-6); }
      :host([data-variant="outline"]) { background: transparent; color: var(--accent-11); border: 1px solid var(--accent-7); }

      :host([data-high-contrast]) { color: var(--gray-12); border-color: var(--gray-12); }
    `;
  }
}

customElements.define("nofo-badge", NofoBadge);
export { NofoBadge };
