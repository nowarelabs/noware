import { NofoElement } from "../../index.js";

class NofoCheckbox extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    "high-contrast": false,
    checked: false,
    defaultChecked: false,
    disabled: false,
    required: false,
    name: "",
    value: "",
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("high-contrast")
      .toDataAttr("high-contrast");

    if (this.defaultChecked && this.checked === false) {
      this.state.checked = true;
    }
  }

  handleChange(e) {
    if (this.disabled) return;
    this.state.checked = e.target.checked;
    this.dispatchEvent(
      new CustomEvent("checked-change", {
        detail: { checked: this.state.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const { name, value, disabled, required, checked } = this.state;
    const isIndeterminate = checked === "indeterminate";

    return `
      <label class="root">
        <input 
          type="checkbox" 
          name="${name}" 
          value="${value}" 
          ?disabled="${disabled}" 
          ?required="${required}"
          .checked="${checked === true}"
          .indeterminate="${isIndeterminate}"
          on-change="handleChange"
        />
        <slot></slot>
      </label>
    `;
  }

  styles() {
    return `
      :host { display: inline-block; box-sizing: border-box; }
      .root { display: inline-flex; alignItems: center; gap: 0.75rem; cursor: pointer; }
      :host([data-disabled]) .root { cursor: not-allowed; opacity: 0.5; }

      input[type="checkbox"] {
        appearance: none;
        margin: 0;
        border-radius: var(--radius-1);
        border: 1px solid var(--gray-7);
        background: var(--color-panel-solid);
        transition: all 0.2s ease;
        position: relative;
        display: grid;
        place-content: center;
      }

      :host([data-size="1"]) input { width: 0.875rem; height: 0.875rem; }
      :host([data-size="2"]) input { width: 1rem; height: 1rem; }
      :host([data-size="3"]) input { width: 1.125rem; height: 1.125rem; }

      input:checked { background: var(--accent-9); border-color: var(--accent-9); }
      input:checked::before {
        content: "";
        width: 0.5em;
        height: 0.5em;
        clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        background-color: white;
      }

      input:indeterminate::before {
        content: "";
        width: 0.5em;
        height: 2px;
        background-color: var(--gray-9);
      }

      ::slotted(*) { flex: 1; pointer-events: none; }
    `;
  }
}

customElements.define("nofo-checkbox", NofoCheckbox);
export { NofoCheckbox };
