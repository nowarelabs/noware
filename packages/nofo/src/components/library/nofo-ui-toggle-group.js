import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIToggleGroup extends NofoElement {
  static props() {
    return {
      type: { type: String, attribute: "type" },
      value: { type: String, attribute: "value" },
      defaultValue: { type: String, attribute: "defaultValue" },
    };
  }

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: inline-flex;
        }
        
        nofo-toggle-group {
          display: inline-flex;
          gap: var(--nofo-ui-spacing-sm);
          padding: var(--nofo-ui-spacing-sm);
          background-color: var(--nofo-ui-background-secondary);
          border: 1px solid var(--nofo-ui-border);
          border-radius: var(--nofo-ui-radius);
        }
      </style>
      <nofo-toggle-group>
        <slot></slot>
      </nofo-toggle-group>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._toggleGroup = this.shadowRoot.querySelector("nofo-toggle-group");
    this.sync();
  }

  sync() {
    if (this._toggleGroup) {
      const type = this.type || "single";
      this._toggleGroup.setAttribute("type", type);

      if (this.value) {
        this._toggleGroup.setAttribute("value", this.value);
      }
      if (this.defaultValue) {
        this._toggleGroup.setAttribute("defaultValue", this.defaultValue);
      }
    }
  }
}

class NofoUIToggleGroupItem extends NofoElement {
  static props() {
    return {
      value: { type: String, attribute: "value" },
      disabled: { type: Boolean, attribute: "disabled" },
    };
  }

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
        
        nofo-toggle-group-item {
          display: inline-flex;
          align-items: center;
          padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
          border-radius: calc(var(--nofo-ui-radius) * 0.5);
          font-size: var(--nofo-ui-font-size-sm);
          font-weight: 500;
          color: var(--nofo-ui-foreground);
          background-color: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        nofo-toggle-group-item:hover {
          background-color: var(--nofo-ui-hover);
        }
        
        nofo-toggle-group-item[data-state="on"] {
          background-color: var(--nofo-ui-accent-primary);
          color: var(--nofo-ui-background);
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
    this._item = this.shadowRoot.querySelector("nofo-toggle-group-item");
    this.sync();
  }

  sync() {
    if (this._item) {
      if (this.value) {
        this._item.setAttribute("value", this.value);
      }
      if (this.disabled) {
        this._item.setAttribute("disabled", "");
      } else {
        this._item.removeAttribute("disabled");
      }
    }
  }
}

customElements.define("nofo-ui-toggle-group", NofoUIToggleGroup);
customElements.define("nofo-ui-toggle-group-item", NofoUIToggleGroupItem);
