import { NofoElement } from "../../index.js";

class NofoButton extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    radius: "medium",
    "high-contrast": false,
    disabled: false,
    loading: false,
    type: "button",
  };

  onMount() {
    const s = this.sync();
    s.attr("size").toDataAttr("size");
    s.attr("variant").toDataAttr("variant");
    s.attr("color").toDataAttr("color");
    s.attr("high-contrast").toDataAttr("high-contrast");
    s.attr("disabled").toDataAttr("disabled");
    s.attr("loading").toDataAttr("loading");
  }

  template() {
    const isLoading = this.state.loading;
    return `
      <button type="${this.type}" ?disabled="${this.state.disabled || isLoading}">
        ${isLoading ? '<span class="loader">●</span>' : ""}
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
        text-decoration: none;
        outline: none;
      }

      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        gap: 8px;
        cursor: inherit;
      }

      .loader {
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      :host([data-size="1"]) { font-size: 0.75rem; height: 1.5rem; padding: 0 0.5rem; }
      :host([data-size="2"]) { font-size: 0.875rem; height: 2rem; padding: 0 0.75rem; }
      :host([data-size="3"]) { font-size: 1rem; height: 2.5rem; padding: 0 1rem; }
      :host([data-size="4"]) { font-size: 1.125rem; height: 3rem; padding: 0 1.25rem; }

      :host([data-variant="solid"]) { background: var(--accent-9); color: white; border: none; }
      :host([data-variant="outline"]) { background: transparent; border: 1px solid var(--accent-9); color: var(--accent-9); }
      :host([data-variant="ghost"]) { background: transparent; border: none; color: var(--accent-9); }

      :host([data-disabled]), :host([data-loading]) {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      :host(:hover:not([data-disabled]):not([data-loading])) {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    `;
  }
}

class NofoIconButton extends NofoElement {
  static props = {
    size: "2",
    variant: "solid",
    color: "accent",
    radius: "medium",
    "high-contrast": false,
    disabled: false,
  };

  onMount() {
    const s = this.sync();
    s.attr("size").toDataAttr("size");
    s.attr("variant").toDataAttr("variant");
    s.attr("color").toDataAttr("color");
    s.attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <button ?disabled="${this.state.disabled}">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }

      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        cursor: inherit;
      }

      :host([data-size="1"]) { width: 1.5rem; height: 1.5rem; }
      :host([data-size="2"]) { width: 2rem; height: 2rem; }
      :host([data-size="3"]) { width: 2.5rem; height: 2.5rem; }
      :host([data-size="4"]) { width: 3rem; height: 3rem; }

      :host([data-variant="solid"]) { background: var(--accent-9); color: white; border: none; }
      :host([data-variant="outline"]) { background: transparent; border: 1px solid var(--accent-9); color: var(--accent-9); }

      :host([data-disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
  }
}

customElements.define("nofo-button", NofoButton);
customElements.define("nofo-icon-button", NofoIconButton);
export { NofoButton, NofoIconButton };
