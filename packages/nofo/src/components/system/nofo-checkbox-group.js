import { NofoElement } from "../../index.js";

class NofoCheckboxGroup extends NofoElement {
  static props = {
    value: [],
    defaultValue: [],
    name: "",
    required: false,
    disabled: false,
  };

  onMount() {
    this.sync().attr("disabled").toDataAttr("disabled");

    if (this.state.value.length === 0 && this.state.defaultValue.length > 0) {
      this.state.value = [...this.state.defaultValue];
    }

    this.effect(["value"], () => {
      this.updateCheckboxes();
    });
  }

  updateCheckboxes() {
    const checkboxes = this.querySelectorAll("nofo-checkbox");
    checkboxes.forEach((checkbox) => {
      const val = checkbox.state.value;
      if (val) {
        checkbox.state.checked = this.state.value.includes(val);
      }
      if (this.state.name) checkbox.state.name = this.state.name;
    });
  }

  handleCheckboxChange(e) {
    const checkbox = e.target.closest("nofo-checkbox");
    if (!checkbox || this.state.disabled) return;

    const val = checkbox.state.value;
    if (!val) return;

    const currentValues = [...this.state.value];
    const isChecked = checkbox.state.checked;

    if (isChecked) {
      if (!currentValues.includes(val)) currentValues.push(val);
    } else {
      const idx = currentValues.indexOf(val);
      if (idx > -1) currentValues.splice(idx, 1);
    }

    this.state.value = currentValues;
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: { value: currentValues },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="root" on-checked-change="handleCheckboxChange">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      :host([data-disabled]) { opacity: 0.5; pointer-events: none; }
    `;
  }
}

customElements.define("nofo-checkbox-group", NofoCheckboxGroup);
export { NofoCheckboxGroup };
