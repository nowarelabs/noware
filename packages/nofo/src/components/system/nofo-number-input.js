import { NofoElement } from "../../index.js";

class NofoNumberInput extends NofoElement {
  static props = {
    value: 0,
    defaultValue: 0,
    min: null,
    max: null,
    step: 1,
    size: "2",
    variant: "surface",
    disabled: false,
    readOnly: false,
    required: false,
    name: "",
  };

  constructor() {
    super();
    this._internalValue = 0;
  }

  onMount() {
    if (this.defaultValue !== undefined) {
      this._internalValue = this.defaultValue;
    }
    if (this.value !== undefined) {
      this._internalValue = this.value;
    }
    this.updateValue();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const decrement = this.querySelector("nofo-number-input-decrement");
    const increment = this.querySelector("nofo-number-input-increment");

    if (decrement) {
      decrement.addEventListener("click", () => {
        if (this.disabled || this.readOnly) return;
        this.decrement();
      });
    }

    if (increment) {
      increment.addEventListener("click", () => {
        if (this.disabled || this.readOnly) return;
        this.increment();
      });
    }

    const input = this.shadowRoot.querySelector("input");
    if (input) {
      input.addEventListener("input", (e) => {
        if (this.disabled || this.readOnly) return;

        const newValue = parseFloat(e.target.value) || 0;
        this._internalValue = this.clampValue(newValue);
        this.attr("value", this._internalValue);

        const event = new CustomEvent("value-change", {
          detail: { value: this._internalValue },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);

        this.updateValue();
      });
    }
  }

  decrement() {
    this._internalValue = this.clampValue(this._internalValue - this.step);
    this.attr("value", this._internalValue);
    this.dispatchChange();
    this.updateValue();
  }

  increment() {
    this._internalValue = this.clampValue(this._internalValue + this.step);
    this.attr("value", this._internalValue);
    this.dispatchChange();
    this.updateValue();
  }

  clampValue(value) {
    const min = this.min ?? -Infinity;
    const max = this.max ?? Infinity;
    return Math.max(min, Math.min(max, value));
  }

  updateValue() {
    const input = this.shadowRoot.querySelector("input");
    const valueDisplay = this.querySelector("nofo-number-input-value");

    if (input) {
      input.value = this._internalValue;
    }
    if (valueDisplay) {
      valueDisplay.textContent = this._internalValue;
    }
  }

  dispatchChange() {
    const event = new CustomEvent("value-change", {
      detail: { value: this._internalValue },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  getSizeStyles(size) {
    const sizes = {
      1: { height: "2rem", fontSize: "0.875rem", padding: "0 0.5rem" },
      2: { height: "2.5rem", fontSize: "1rem", padding: "0 0.75rem" },
      3: { height: "3rem", fontSize: "1.125rem", padding: "0 1rem" },
    };
    return sizes[size] || sizes["2"];
  }

  getVariantStyles(variant) {
    const variants = {
      surface: {
        backgroundColor: "var(--color-panel-solid)",
        border: "1px solid var(--gray-6)",
      },
      classic: {
        backgroundColor: "var(--color-panel-solid)",
        border: "2px solid var(--gray-6)",
      },
      soft: {
        backgroundColor: "var(--gray-2)",
        border: "1px solid var(--gray-5)",
      },
      ghost: {
        backgroundColor: "transparent",
        border: "none",
      },
    };
    return variants[variant] || variants["surface"];
  }

  template() {
    const sizeStyles = this.getSizeStyles(this.size);
    const variantStyles = this.getVariantStyles(this.variant);

    const styles = {
      ...sizeStyles,
      ...variantStyles,
      borderRadius: "var(--radius)",
      color: "var(--gray-12)",
      outline: "none",
      transition: "all 0.2s ease",
      width: "100%",
      textAlign: "center",
      fontFamily: "inherit",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    const inputStyles = {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-1)",
      width: "100%",
    };

    const inputStyleString = Object.entries(inputStyles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    const minAttr = this.min ? `min="${this.min}"` : "";
    const maxAttr = this.max ? `max="${this.max}"` : "";
    const stepAttr = this.step ? `step="${this.step}"` : "";
    const nameAttr = this.name ? `name="${this.name}"` : "";
    const disabledAttr = this.disabled ? "disabled" : "";
    const readOnlyAttr = this.readOnly ? "readonly" : "";
    const requiredAttr = this.required ? "required" : "";

    return `
      <div class="number-input-wrapper" style="${inputStyleString}">
        <slot name="decrement"></slot>
        <input 
          type="number" 
          ${minAttr}
          ${maxAttr}
          ${stepAttr}
          ${nameAttr}
          ${disabledAttr}
          ${readOnlyAttr}
          ${requiredAttr}
          style="${styleString} flex: 1; border: none;"
        />
        <slot name="increment"></slot>
      </div>
      <slot name="value"></slot>
    `;
  }

  styles() {
    return `
      :host {
        display: inline-flex;
        position: relative;
        box-sizing: border-box;
        width: 100%;
      }
      input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoNumberInputDecrement extends NofoElement {
  template() {
    return `
      <button type="button" slot="decrement">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border: none;
        background-color: var(--gray-3);
        border-radius: var(--radius);
        cursor: pointer;
        font-size: 1rem;
        font-weight: 600;
        color: var(--gray-11);
        transition: all 0.2s;
        flex-shrink: 0;
        box-sizing: border-box;
      }
      :host(:hover) {
        background-color: var(--gray-4);
      }
    `;
  }
}

class NofoNumberInputIncrement extends NofoElement {
  template() {
    return `
      <button type="button" slot="increment">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border: none;
        background-color: var(--gray-3);
        border-radius: var(--radius);
        cursor: pointer;
        font-size: 1rem;
        font-weight: 600;
        color: var(--gray-11);
        transition: all 0.2s;
        flex-shrink: 0;
        box-sizing: border-box;
      }
      :host(:hover) {
        background-color: var(--gray-4);
      }
    `;
  }
}

class NofoNumberInputValue extends NofoElement {
  template() {
    return `<slot slot="value"></slot>`;
  }

  styles() {
    return `
      :host {
        display: contents;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-number-input", NofoNumberInput);
customElements.define("nofo-number-input-decrement", NofoNumberInputDecrement);
customElements.define("nofo-number-input-increment", NofoNumberInputIncrement);
customElements.define("nofo-number-input-value", NofoNumberInputValue);

export {
  NofoNumberInput,
  NofoNumberInputDecrement,
  NofoNumberInputIncrement,
  NofoNumberInputValue,
};
