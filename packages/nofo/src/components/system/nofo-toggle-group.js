import { NofoElement } from "../../index.js";

class NofoToggleGroup extends NofoElement {
  static props = {
    type: { type: String, reflect: true },
    value: { type: String, reflect: true },
    defaultValue: { type: String },
    size: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    color: { type: String, reflect: true },
  };

  _value = [];

  onMount() {
    const type = this.type || "single";
    if (this.defaultValue) {
      this._value = type === "multiple" ? [this.defaultValue] : this.defaultValue;
    }
    if (this.value) {
      try {
        const value = JSON.parse(this.value);
        this._value = type === "multiple" ? (Array.isArray(value) ? value : [value]) : value;
      } catch (e) {
        this._value = type === "multiple" ? [this.value] : this.value;
      }
    }
    this.updateItems();

    this.addEventListener("click", (e) => {
      const item = e.target.closest("nofo-toggle-group-item");
      if (!item || item.disabled) return;

      const value = item.value;
      if (!value) return;

      const type = this.type || "single";

      if (type === "single") {
        const isPressed = this._value === value;
        this._value = isPressed ? null : value;
      } else {
        const isPressed = Array.isArray(this._value) && this._value.includes(value);
        if (isPressed) {
          this._value = this._value.filter((v) => v !== value);
        } else {
          this._value = [...(Array.isArray(this._value) ? this._value : []), value];
        }
      }

      const event = new CustomEvent("value-change", {
        detail: { value: this._value },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

      this.updateItems();
    });
  }

  updateItems() {
    const items = this.querySelectorAll("nofo-toggle-group-item");
    const type = this.type || "single";

    items.forEach((item) => {
      const value = item.value;
      if (!value) return;

      let isPressed = false;
      if (type === "single") {
        isPressed = this._value === value;
      } else {
        isPressed = Array.isArray(this._value) && this._value.includes(value);
      }

      if (isPressed) {
        item.pressed = true;
      } else {
        item.pressed = false;
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: inline-flex;
        gap: 0.125rem;
        background-color: var(--gray-3);
        padding: 0.125rem;
        border-radius: var(--radius);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoToggleGroupItem extends NofoElement {
  static props = {
    value: { type: String, reflect: true },
    pressed: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  template() {
    return `<button type="button" ${this.disabled ? "disabled" : ""}><slot></slot></button>`;
  }

  styles() {
    const toggleGroup = this.closest("nofo-toggle-group");
    const size = toggleGroup ? toggleGroup.size || "2" : "2";
    const variant = toggleGroup ? toggleGroup.variant || "outline" : "outline";
    const color = toggleGroup ? toggleGroup.color || "accent" : "accent";

    const sizeStyles = {
      1: { padding: "0.375rem", fontSize: "0.875rem" },
      2: { padding: "0.5rem", fontSize: "1rem" },
      3: { padding: "0.625rem", fontSize: "1.125rem" },
    };
    const s = sizeStyles[size] || sizeStyles["2"];

    return `
      :host {
        padding: ${s.padding};
        font-size: ${s.fontSize};
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--radius);
        cursor: ${this.disabled ? "not-allowed" : "pointer"};
        transition: all 0.2s;
        background-color: ${this.pressed ? `var(--${color}-9)` : "transparent"};
        color: ${this.pressed ? "var(--gray-1)" : "var(--gray-11)"};
        opacity: ${this.disabled ? "0.5" : "1"};
        box-sizing: border-box;
      }
      ${!this.disabled && !this.pressed ? `:host(:hover) { background-color: var(--gray-4); }` : ""}
    `;
  }
}

customElements.define("nofo-toggle-group", NofoToggleGroup);
customElements.define("nofo-toggle-group-item", NofoToggleGroupItem);

export { NofoToggleGroup, NofoToggleGroupItem };
