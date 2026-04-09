import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIToggle extends NofoElement {
  static props() {
    return {
      pressed: { type: Boolean, attribute: "pressed" },
      defaultPressed: { type: Boolean, attribute: "defaultPressed" },
      disabled: { type: Boolean, attribute: "disabled" },
      size: { type: String, attribute: "size" },
      variant: { type: String, attribute: "variant" },
    };
  }

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: inline-block;
        }
        
        nofo-toggle-group-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
          border: 1px solid var(--nofo-ui-border);
          border-radius: var(--nofo-ui-radius);
          background-color: var(--nofo-ui-background-secondary);
          color: var(--nofo-ui-foreground);
          font-size: var(--nofo-ui-font-size-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        nofo-toggle-group-item:hover {
          background-color: var(--nofo-ui-hover);
          border-color: var(--nofo-ui-accent-primary);
        }
        
        nofo-toggle-group-item[pressed] {
          background-color: var(--nofo-ui-accent-primary);
          color: var(--nofo-ui-background);
          border-color: var(--nofo-ui-accent-primary);
        }
        
        nofo-toggle-group-item[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
      <nofo-toggle-group-item>
        <slot></slot>
      </nofo-toggle-group-item>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._toggle = this.shadowRoot.querySelector("nofo-toggle-group-item");
    this.sync();
  }

  sync() {
    if (this._toggle) {
      if (this.pressed) {
        this._toggle.setAttribute("pressed", "");
      } else {
        this._toggle.removeAttribute("pressed");
      }

      if (this.disabled) {
        this._toggle.setAttribute("disabled", "");
      } else {
        this._toggle.removeAttribute("disabled");
      }

      const size = this.size || "md";
      const sizeMap = {
        sm: "1",
        md: "2",
        lg: "3",
      };
      this._toggle.setAttribute("size", sizeMap[size] || "2");

      const variant = this.variant || "outline";
      this._toggle.setAttribute("variant", variant);
    }
  }
}

customElements.define("nofo-ui-toggle", NofoUIToggle);
