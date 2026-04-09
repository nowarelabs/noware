import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUINativeSelect extends NofoElement {
  static props = {
    name: "",
    disabled: false,
    required: false,
    multiple: false,
    size: "",
  };

  onMount() {
    this.sync()
      .attr("name")
      .toDataAttr("name")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("required")
      .toDataAttr("required")
      .attr("multiple")
      .toDataAttr("multiple")
      .attr("size")
      .toDataAttr("size");
  }

  template() {
    const { name, disabled, required, multiple, size } = this.state;
    return `
      <select 
        name="${name}"
        ?disabled="${disabled}"
        ?required="${required}"
        ?multiple="${multiple}"
        size="${size}"
      >
        <slot></slot>
      </select>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      select {
        width: 100%;
        padding: var(--nofo-ui-spacing-md);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        color: var(--nofo-ui-foreground);
        font-family: var(--nofo-ui-font-family);
        font-size: var(--nofo-ui-font-size-base);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      select:focus {
        border-color: var(--nofo-ui-accent-primary);
        box-shadow: 0 0 0 3px var(--nofo-ui-focus);
        outline: none;
      }
      select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      select option {
        background-color: var(--nofo-ui-background-secondary);
        color: var(--nofo-ui-foreground);
      }
    `;
  }
}

customElements.define("nofo-ui-native-select", NofoUINativeSelect);
export { NofoUINativeSelect };
