import { NofoElement } from "../../index.js";

class NofoCallout extends NofoElement {
  static props = {
    size: "2",
    variant: "soft",
    color: "indigo",
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
      .attr("high-contrast")
      .toDataAttr("high-contrast");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: flex-start;
        border-radius: 0.375rem;
        box-sizing: border-box;
        width: 100%;
      }

      /* Sizes */
      :host([data-size="1"]) { padding: 0.5rem; gap: 0.5rem; font-size: 0.875rem; }
      :host([data-size="2"]) { padding: 0.75rem; gap: 0.75rem; font-size: 1rem; }
      :host([data-size="3"]) { padding: 1rem; gap: 1rem; font-size: 1.125rem; }

      /* Variants */
      :host([data-variant="solid"]) { background: var(--accent-9); color: white; border: none; }
      :host([data-variant="soft"]) { background: var(--accent-3); color: var(--accent-11); border: none; }
      :host([data-variant="surface"]) { background: var(--color-panel-solid); color: var(--gray-11); border: 1px solid var(--gray-6); }
      :host([data-variant="outline"]) { background: transparent; color: var(--accent-11); border: 1px solid var(--accent-7); }

      :host([data-high-contrast]) { color: var(--gray-12); }
    `;
  }
}

class NofoCalloutIcon extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
    `;
  }
}

class NofoCalloutText extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: block;
        flex: 1;
      }
    `;
  }
}

customElements.define("nofo-callout", NofoCallout);
customElements.define("nofo-callout-icon", NofoCalloutIcon);
customElements.define("nofo-callout-text", NofoCalloutText);

export { NofoCallout, NofoCalloutIcon, NofoCalloutText };
