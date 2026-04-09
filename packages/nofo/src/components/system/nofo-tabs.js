import { NofoElement } from "../../index.js";

class NofoTabs extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    orientation: "horizontal",
    "activation-mode": "automatic",
  };

  onMount() {
    this.sync().attr("orientation").toDataAttr("orientation").attr("value").toDataAttr("value");

    if (this.state.value === null && this.state.defaultValue !== null) {
      this.state.value = this.state.defaultValue;
    }

    this.addEventListener("nofo-tabs-select", (e) => {
      const { value } = e.detail;
      this.state.value = value;

      this.dispatchEvent(
        new CustomEvent("value-change", {
          detail: { value },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        width: 100%;
        box-sizing: border-box;
      }
      :host([data-orientation="vertical"]) { flex-direction: row; }
      :host([data-orientation="horizontal"]) { flex-direction: column; }
    `;
  }
}

class NofoTabsList extends NofoElement {
  static props = {
    size: "1",
  };

  onMount() {
    this.sync().attr("size").toDataAttr("size");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        gap: var(--space-1);
        box-sizing: border-box;
      }
      /* Orientation inherited from parent nofo-tabs */
      :host-context(nofo-tabs[data-orientation="horizontal"]) {
        flex-direction: row;
        border-bottom: 1px solid var(--gray-6);
      }
      :host-context(nofo-tabs[data-orientation="vertical"]) {
        flex-direction: column;
        border-right: 1px solid var(--gray-6);
      }
    `;
  }
}

class NofoTabsTrigger extends NofoElement {
  static props = {
    value: null,
    disabled: false,
  };

  onMount() {
    this.sync().attr("disabled").toDataAttr("disabled");

    const tabs = this.closest("nofo-tabs");
    if (tabs) {
      this.effect(() => {
        const isActive = tabs.state.value === this.state.value;
        this.setAttribute("data-state", isActive ? "active" : "inactive");
      });
    }
  }

  handleClick() {
    if (this.state.disabled) return;
    this.dispatchEvent(
      new CustomEvent("nofo-tabs-select", {
        detail: { value: this.state.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <button type="button" ?disabled="${this.state.disabled}" on-click="handleClick">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0.5rem 1rem;
        cursor: pointer;
        opacity: 1;
        font-size: 0.875rem;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      :host([data-disabled]) { cursor: not-allowed; opacity: 0.5; }
      
      button {
        all: unset;
        display: flex;
        align-items: center;
        gap: inherit;
        width: 100%;
        height: 100%;
      }

      :host([data-state="active"]) {
        color: var(--accent-11);
        font-weight: 500;
      }

      :host-context(nofo-tabs[data-orientation="horizontal"]) {
        border-bottom: 2px solid transparent;
      }
      :host-context(nofo-tabs[data-orientation="horizontal"][data-state="active"]) {
        border-bottom-color: var(--accent-9);
      }

      :host-context(nofo-tabs[data-orientation="vertical"]) {
        border-right: 2px solid transparent;
      }
      :host-context(nofo-tabs[data-orientation="vertical"][data-state="active"]) {
        border-right-color: var(--accent-9);
      }

      :host(:not([data-disabled]):hover) {
        color: var(--accent-11);
        background-color: var(--gray-2);
      }
    `;
  }
}

class NofoTabsContent extends NofoElement {
  static props = {
    value: null,
  };

  onMount() {
    const tabs = this.closest("nofo-tabs");
    if (tabs) {
      this.effect(() => {
        const isActive = tabs.state.value === this.state.value;
        this.setAttribute("data-state", isActive ? "active" : "inactive");
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: none;
        width: 100%;
        box-sizing: border-box;
      }
      :host([data-state="active"]) { display: block; }
    `;
  }
}

customElements.define("nofo-tabs", NofoTabs);
customElements.define("nofo-tabs-list", NofoTabsList);
customElements.define("nofo-tabs-trigger", NofoTabsTrigger);
customElements.define("nofo-tabs-content", NofoTabsContent);

export { NofoTabs, NofoTabsList, NofoTabsTrigger, NofoTabsContent };
