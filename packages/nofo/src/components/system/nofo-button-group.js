import { NofoElement } from "../../index.js";

class NofoButtonGroup extends NofoElement {
  static props = {
    orientation: "horizontal",
    attached: false,
    size: "2",
    variant: "solid",
  };

  onMount() {
    const s = this.sync();
    s.attr("orientation").toDataAttr("orientation");
    s.attr("size").toDataAttr("size");
    s.attr("variant").toDataAttr("variant");
    s.attr("attached").toDataAttr("attached");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const { orientation, attached } = this.state;
    return `
      :host {
        display: inline-flex;
        flex-direction: ${orientation === "vertical" ? "column" : "row"};
        gap: ${attached ? "0" : "var(--space-1)"};
        box-sizing: border-box;
      }
      ${
        attached
          ? `
        ::slotted(nofo-button),
        ::slotted(nofo-icon-button) {
          border-radius: 0;
        }
        ::slotted(nofo-button:first-child),
        ::slotted(nofo-icon-button:first-child) {
          border-top-left-radius: var(--radius);
          border-bottom-left-radius: var(--radius);
        }
        ::slotted(nofo-button:last-child),
        ::slotted(nofo-icon-button:last-child) {
          border-top-right-radius: var(--radius);
          border-bottom-right-radius: var(--radius);
        }
        ::slotted(nofo-button:not(:last-child)),
        ::slotted(nofo-icon-button:not(:last-child)) {
          border-right: none;
        }
      `
          : ""
      }
    `;
  }
}

customElements.define("nofo-button-group", NofoButtonGroup);
export { NofoButtonGroup };
