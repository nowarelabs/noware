import { NofoElement } from "../../index.js";

class NofoRadioGroup extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    name: "",
    required: false,
    disabled: false,
    orientation: "vertical",
  };

  onMount() {
    this.sync()
      .attr("orientation")
      .toDataAttr("orientation")
      .attr("disabled")
      .toDataAttr("disabled");

    if (!this.state.value && this.state.defaultValue) {
      this.state.value = this.state.defaultValue;
    }

    this.effect(["value"], () => {
      this.updateRadios();
    });
  }

  updateRadios() {
    const radios = this.querySelectorAll("nofo-radio");
    radios.forEach((radio) => {
      radio.state.checked = radio.state.value === this.state.value;
      if (this.state.name) radio.state.name = this.state.name;
    });
  }

  handleRadioChange(e) {
    const radio = e.target.closest("nofo-radio");
    if (!radio || this.state.disabled) return;

    const newValue = radio.state.value;
    if (newValue === this.state.value) return;

    this.state.value = newValue;
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: { value: newValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="root" on-change="handleRadioChange">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    const orientation = this.state.orientation || "vertical";
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        flex-direction: ${orientation === "horizontal" ? "row" : "column"};
        gap: var(--space-2);
      }
    `;
  }
}

class NofoRadio extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    "high-contrast": false,
    value: "",
    name: "",
    checked: false,
    disabled: false,
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("checked")
      .toDataAttr("checked")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("high-contrast")
      .toDataAttr("high-contrast");
  }

  handleChange(e) {
    if (this.state.disabled) return;
    this.state.checked = e.target.checked;

    this.dispatchEvent(
      new Event("change", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const { name, value, checked, disabled } = this.state;
    return `
      <label class="radio-label">
        <input 
          type="radio" 
          name="${name}" 
          value="${value}" 
          ?checked="${checked}" 
          ?disabled="${disabled}"
          on-change="handleChange"
        />
        <div class="radio-ui"></div>
        <slot></slot>
      </label>
    `;
  }

  styles() {
    return `
      :host { display: inline-flex; align-items: center; box-sizing: border-box; }
      .radio-label {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        position: relative;
      }
      :host([data-disabled]) .radio-label { cursor: not-allowed; opacity: 0.5; }

      input[type="radio"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }

      .radio-ui {
        box-sizing: border-box;
        border: 1px solid var(--gray-7);
        border-radius: 50%;
        background: var(--color-panel-solid);
        transition: all 0.2s ease;
        display: grid;
        place-content: center;
      }

      :host([data-size="1"]) .radio-ui { width: 0.875rem; height: 0.875rem; }
      :host([data-size="2"]) .radio-ui { width: 1rem; height: 1rem; }
      :host([data-size="3"]) .radio-ui { width: 1.125rem; height: 1.125rem; }

      :host([data-checked]) .radio-ui {
        background: var(--accent-9);
        border-color: var(--accent-9);
      }

      .radio-ui::after {
        content: "";
        width: 0.375rem;
        height: 0.375rem;
        border-radius: 50%;
        background: white;
        transform: scale(0);
        transition: transform 0.2s ease;
      }

      :host([data-checked]) .radio-ui::after {
        transform: scale(1);
      }

      ::slotted(*) { flex: 1; pointer-events: none; }
    `;
  }
}

customElements.define("nofo-radio-group", NofoRadioGroup);
customElements.define("nofo-radio", NofoRadio);

export { NofoRadioGroup, NofoRadio };
