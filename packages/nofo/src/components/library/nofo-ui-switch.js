import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISwitch extends NofoElement {
  static props = {
    checked: false,
    defaultChecked: false,
    disabled: false,
    name: "",
    required: false,
    size: "2",
    variant: "solid",
    color: "accent",
  };

  onMount() {
    this.sync().attr("checked").toDataAttr("checked").attr("disabled").toDataAttr("disabled");
  }

  handleCheckedChange(e) {
    const newChecked = e.detail.checked;
    this.state.checked = newChecked;
    this.dispatchEvent(
      new CustomEvent("checked-change", {
        detail: { checked: newChecked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const { checked, defaultChecked, disabled, name, required, size, variant, color } = this.state;
    return `
      <div class="root">
        <nofo-switch
          ?checked="${checked}"
          ?defaultChecked="${defaultChecked}"
          ?disabled="${disabled}"
          name="${name}"
          ?required="${required}"
          size="${size}"
          variant="${variant}"
          color="${color}"
          on-checked-change="handleCheckedChange"
        >
          <slot></slot>
        </nofo-switch>
        <span class="label">
          <slot name="label"></slot>
        </span>
      </div>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-flex; vertical-align: middle; }
      .root { display: flex; align-items: center; gap: 0.75rem; }
      
      nofo-switch {
        --accent-9: var(--nofo-ui-accent-primary);
        --gray-6: var(--nofo-ui-background-secondary);
      }

      .label {
        font-size: 0.875rem;
        color: var(--nofo-ui-foreground);
        user-select: none;
      }
      
      :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
    `;
  }
}

customElements.define("nofo-ui-switch", NofoUISwitch);
export { NofoUISwitch };
