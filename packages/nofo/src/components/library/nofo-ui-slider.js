import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISlider extends NofoElement {
  static props = {
    value: [50],
    defaultValue: [50],
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    size: "2",
    variant: "solid",
    color: "accent",
    orientation: "horizontal",
  };

  onMount() {
    this.sync().attr("disabled").toDataAttr("disabled");

    this.effect(["value"], () => {
      if (typeof this.state.value === "string") {
        try {
          this.state.value = JSON.parse(this.state.value);
        } catch (e) {
          this.state.value = [parseFloat(this.state.value)];
        }
      }
    });
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
    const { value, defaultValue, min, max, step, disabled, size, variant, color, orientation } =
      this.state;
    const valueArray = Array.isArray(value) ? value : [value];
    const defaultValueArray = Array.isArray(defaultValue) ? defaultValue : [defaultValue];

    return `
      <nofo-slider
        value='${JSON.stringify(valueArray)}'
        defaultValue='${JSON.stringify(defaultValueArray)}'
        min="${min}"
        max="${max}"
        step="${step}"
        ?disabled="${disabled}"
        size="${size}"
        variant="${variant}"
        color="${color}"
        orientation="${orientation}"
        on-value-change="handleValueChange"
      >
        <slot></slot>
      </nofo-slider>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-slider {
        --accent-9: var(--nofo-ui-accent-primary);
        --gray-6: var(--nofo-ui-background-secondary);
      }
      :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
    `;
  }
}

customElements.define("nofo-ui-slider", NofoUISlider);
export { NofoUISlider };
