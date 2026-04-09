import { NofoElement } from "../../index.js";

class NofoSpinner extends NofoElement {
  static props = {
    size: "2",
    loading: true,
  };

  onMount() {
    this.sync().attr("size").toDataAttr("size").attr("loading").toDataAttr("loading");
  }

  template() {
    return ``;
  }

  styles() {
    return `
      :host {
        display: inline-block;
        box-sizing: border-box;
        border-radius: 50%;
        border: 2px solid var(--gray-6);
        border-top-color: var(--accent-9);
        animation: nofo-spin 0.8s linear infinite;
      }

      :host([loading="false"]) { display: none; }

      /* Sizes */
      :host([data-size="1"]) { width: 1rem; height: 1rem; }
      :host([data-size="2"]) { width: 1.5rem; height: 1.5rem; }
      :host([data-size="3"]) { width: 2rem; height: 2rem; }

      @keyframes nofo-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
  }
}

customElements.define("nofo-spinner", NofoSpinner);
export { NofoSpinner };
