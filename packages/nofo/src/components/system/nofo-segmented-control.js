import { NofoElement } from "../../index.js";

class NofoSegmentedControl extends NofoElement {
  static props = {
    value: { type: String, reflect: true },
    defaultValue: { type: String },
    size: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    color: { type: String, reflect: true },
    radius: { type: String, reflect: true },
  };

  _value = null;

  onMount() {
    if (this.defaultValue) {
      this._value = this.defaultValue;
    }
    if (this.value) {
      this._value = this.value;
    }
    this.updateItems();

    this.addEventListener("click", (e) => {
      const item = e.target.closest("nofo-segmented-control-item");
      if (!item || item.disabled) return;

      const value = item.value;
      if (!value) return;

      this._value = value;

      const event = new CustomEvent("value-change", {
        detail: { value },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

      this.updateItems();
    });
  }

  updateItems() {
    const items = this.querySelectorAll("nofo-segmented-control-item");
    items.forEach((item) => {
      const value = item.value;
      if (value === this._value) {
        item.selected = true;
      } else {
        item.selected = false;
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const radius = this.radius || "medium";
    const radiusMap = {
      none: "0",
      small: "0.125rem",
      medium: "0.25rem",
      large: "0.5rem",
      full: "9999px",
    };
    const borderRadius = radiusMap[radius] || radiusMap["medium"];

    return `
      :host {
        display: inline-flex;
        background-color: var(--gray-3);
        border-radius: ${borderRadius};
        padding: 0.125rem;
        gap: 0;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoSegmentedControlItem extends NofoElement {
  static props = {
    value: { type: String, reflect: true },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const control = this.closest("nofo-segmented-control");
    const color = control ? control.color || "accent" : "accent";

    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        cursor: ${this.disabled ? "not-allowed" : "pointer"};
        background-color: ${this.selected ? "var(--color-panel-solid)" : "transparent"};
        color: ${this.selected ? `var(--${color}-11)` : "var(--gray-11)"};
        font-weight: ${this.selected ? "500" : "400"};
        opacity: ${this.disabled ? "0.5" : "1"};
        transition: all 0.2s ease;
        white-space: nowrap;
        box-sizing: border-box;
      }
      ${!this.disabled && !this.selected ? `:host(:hover) { color: var(--${color}-11); }` : ""}
    `;
  }
}

customElements.define("nofo-segmented-control", NofoSegmentedControl);
customElements.define("nofo-segmented-control-item", NofoSegmentedControlItem);

export { NofoSegmentedControl, NofoSegmentedControlItem };
