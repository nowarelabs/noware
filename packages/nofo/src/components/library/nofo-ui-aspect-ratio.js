import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIAspectRatio extends NofoElement {
  static props = {
    ratio: { type: String, default: "16/9" },
  };

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          width: 100%;
        }
        
        nofo-aspect-ratio {
          display: block;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
      </style>
      <nofo-aspect-ratio>
        <slot></slot>
      </nofo-aspect-ratio>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._aspectRatio = this.shadowRoot.querySelector("nofo-aspect-ratio");
    this.sync();
  }

  sync() {
    if (this._aspectRatio) {
      const ratio = this.ratio || "16/9";
      this._aspectRatio.setAttribute("ratio", ratio);
    }
  }
}

customElements.define("nofo-ui-aspect-ratio", NofoUIAspectRatio);
