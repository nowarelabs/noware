import { NofoElement } from "../../index.js";

class NofoCollapsible extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (val) => (val ? "open" : "closed"));

    if (this.state.open === false && this.state.defaultOpen === true) {
      this.state.open = true;
    }

    this.addEventListener("nofo-collapsible-toggle", () => {
      this.state.open = !this.state.open;
      this.dispatchEvent(
        new CustomEvent("open-change", {
          detail: { open: this.state.open },
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
        flex-direction: column;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCollapsibleTrigger extends NofoElement {
  onMount() {
    const parent = this.closest("nofo-collapsible");
    if (parent) {
      this.effect(() => {
        this.setAttribute("data-state", parent.state.open ? "open" : "closed");
      });
    }
  }

  handleClick() {
    this.dispatchEvent(
      new CustomEvent("nofo-collapsible-toggle", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <button type="button" on-click="handleClick">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        background-color: transparent;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background-color 0.2s;
        box-sizing: border-box;
      }
      button:hover {
        background-color: var(--gray-2);
      }
      
      ::slotted(nofo-icon) {
        transition: transform 0.2s ease;
      }
      :host([data-state="open"]) ::slotted(nofo-icon) {
        transform: rotate(180deg);
      }
    `;
  }
}

class NofoCollapsibleContent extends NofoElement {
  onMount() {
    const parent = this.closest("nofo-collapsible");
    if (parent) {
      this.effect(() => {
        this.setAttribute("data-state", parent.state.open ? "open" : "closed");
      });
    }
  }

  template() {
    return `
      <div class="content-inner">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host {
        display: none;
        overflow: hidden;
        box-sizing: border-box;
      }
      :host([data-state="open"]) {
        display: block;
      }
      .content-inner {
        padding: 0 0.75rem 0.75rem 0.75rem;
      }
    `;
  }
}

customElements.define("nofo-collapsible", NofoCollapsible);
customElements.define("nofo-collapsible-trigger", NofoCollapsibleTrigger);
customElements.define("nofo-collapsible-content", NofoCollapsibleContent);

export { NofoCollapsible, NofoCollapsibleTrigger, NofoCollapsibleContent };
