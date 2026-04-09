import { NofoElement } from "../../index.js";

class NofoSwitch extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    "high-contrast": false,
    radius: "full",
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
      .attr("radius")
      .toDataAttr("radius")
      .attr("checked")
      .toDataAttr("checked")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("high-contrast")
      .toDataAttr("high-contrast");

    if (!this.state.checked && this.state.defaultChecked) {
      this.state.checked = true;
    }
  }

  handleToggle() {
    if (this.state.disabled) return;
    this.commit("checked", (v) => !v);
    this.dispatchEvent(
      new CustomEvent("checked-change", {
        detail: { checked: this.state.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const { checked, disabled } = this.state;
    return `
      <div class="switch-container" on-click="handleToggle">
        <div class="switch">
          <div class="switch-thumb"></div>
        </div>
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: inline-flex; align-items: center; box-sizing: border-box; }
      .switch-container {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
      }
      :host([data-disabled]) .switch-container { cursor: not-allowed; opacity: 0.5; }

      .switch {
        position: relative;
        background-color: var(--gray-6);
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      :host([data-size="1"]) .switch { width: 2rem; height: 1.25rem; }
      :host([data-size="2"]) .switch { width: 2.5rem; height: 1.5rem; }
      :host([data-size="3"]) .switch { width: 3rem; height: 1.75rem; }

      :host([data-radius="none"]) .switch, :host([data-radius="none"]) .switch-thumb { border-radius: 0; }
      :host([data-radius="small"]) .switch, :host([data-radius="small"]) .switch-thumb { border-radius: 0.125rem; }
      :host([data-radius="medium"]) .switch, :host([data-radius="medium"]) .switch-thumb { border-radius: 0.25rem; }
      :host([data-radius="large"]) .switch, :host([data-radius="large"]) .switch-thumb { border-radius: 0.5rem; }
      :host([data-radius="full"]) .switch, :host([data-radius="full"]) .switch-thumb { border-radius: 9999px; }

      :host([data-checked]) .switch {
        background-color: var(--accent-9);
      }

      .switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        background-color: white;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      :host([data-size="1"]) .switch-thumb { width: 0.875rem; height: 0.875rem; }
      :host([data-size="2"]) .switch-thumb { width: 1.125rem; height: 1.125rem; }
      :host([data-size="3"]) .switch-thumb { width: 1.375rem; height: 1.375rem; }

      :host([data-checked][data-size="1"]) .switch-thumb { transform: translateX(calc(2rem - 0.875rem - 4px)); }
      :host([data-checked][data-size="2"]) .switch-thumb { transform: translateX(calc(2.5rem - 1.125rem - 4px)); }
      :host([data-checked][data-size="3"]) .switch-thumb { transform: translateX(calc(3rem - 1.375rem - 4px)); }

      ::slotted(*) { flex: 1; pointer-events: none; }
    `;
  }
}

customElements.define("nofo-switch", NofoSwitch);
export { NofoSwitch };
