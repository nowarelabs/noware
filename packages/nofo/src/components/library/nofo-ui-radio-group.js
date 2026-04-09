import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIRadioGroup extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    name: "",
    disabled: false,
    orientation: "vertical",
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  handleValueChange(e) {
    const newValue = e.detail.value;
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
    const { value, defaultValue, name, disabled, orientation } = this.state;
    return `
      <nofo-radio-group
        value="${value || ""}"
        defaultValue="${defaultValue || ""}"
        name="${name}"
        ?disabled="${disabled}"
        orientation="${orientation}"
        on-value-change="handleValueChange"
      >
        <slot></slot>
      </nofo-radio-group>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
    `;
  }
}

class NofoUIRadioItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    const { value, disabled } = this.state;
    return `
      <nofo-radio value="${value}" ?disabled="${disabled}">
        <slot></slot>
      </nofo-radio>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-radio {
        --accent-9: var(--nofo-ui-accent-primary);
        --accent-3: var(--nofo-ui-accent-secondary);
        --gray-7: var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUIRadioIndicator extends NofoElement {
  template() {
    return ``;
  }
  styles() {
    return `:host { display: none; }`;
  }
}

customElements.define("nofo-ui-radio-group", NofoUIRadioGroup);
customElements.define("nofo-ui-radio-item", NofoUIRadioItem);
customElements.define("nofo-ui-radio-indicator", NofoUIRadioIndicator);

export { NofoUIRadioGroup, NofoUIRadioItem, NofoUIRadioIndicator };
