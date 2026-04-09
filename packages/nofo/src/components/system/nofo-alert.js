import { NofoElement } from "../../index.js";

class NofoAlert extends NofoElement {
  static props = {
    variant: "info",
    size: "2",
    dismissible: false,
    open: true,
  };

  onMount() {
    this.sync()
      .attr("variant")
      .toDataAttr("variant")
      .attr("size")
      .toDataAttr("size")
      .attr("open")
      .toDataAttr("state", (val) => (val ? "open" : "closed"));
  }

  handleClose() {
    this.state.open = false;
    this.dispatchEvent(
      new CustomEvent("open-change", {
        detail: { open: false },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const { dismissible, open } = this.state;
    if (!open) return "";

    return `
      <slot name="icon"></slot>
      <div class="alert-content">
        <slot></slot>
      </div>
      ${
        dismissible
          ? `
        <button class="alert-close" aria-label="Close" on-click="handleClose">
          <nofo-icon name="cross"></nofo-icon>
        </button>
      `
          : ""
      }
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        border-radius: var(--radius);
        position: relative;
        box-sizing: border-box;
      }
      :host([data-state="closed"]) { display: none; }

      /* Variants */
      :host([data-variant="info"]) { background: var(--blue-3); border: 1px solid var(--blue-7); color: var(--blue-11); }
      :host([data-variant="success"]) { background: var(--green-3); border: 1px solid var(--green-7); color: var(--green-11); }
      :host([data-variant="warning"]) { background: var(--amber-3); border: 1px solid var(--amber-7); color: var(--amber-11); }
      :host([data-variant="error"]) { background: var(--red-3); border: 1px solid var(--red-7); color: var(--red-11); }

      /* Sizes */
      :host([data-size="1"]) { padding: 0.75rem; font-size: 0.875rem; }
      :host([data-size="2"]) { padding: 1rem; font-size: 1rem; }
      :host([data-size="3"]) { padding: 1.25rem; font-size: 1.125rem; }

      .alert-content { flex: 1; }
      .alert-close {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }
      .alert-close:hover { opacity: 1; }
    `;
  }
}

class NofoAlertIcon extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAlertContent extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        flex: 1;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAlertTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        font-weight: 600;
        font-size: inherit;
        line-height: 1.5;
        margin-bottom: 0.25rem;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoAlertDescription extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        font-size: inherit;
        line-height: 1.5;
        opacity: 0.9;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoAlertClose extends NofoElement {
  onMount() {
    this.addEventListener("click", () => {
      const alert = this.closest("nofo-alert");
      if (alert) alert.state.open = false;
    });
  }
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-alert", NofoAlert);
customElements.define("nofo-alert-icon", NofoAlertIcon);
customElements.define("nofo-alert-content", NofoAlertContent);
customElements.define("nofo-alert-title", NofoAlertTitle);
customElements.define("nofo-alert-description", NofoAlertDescription);
customElements.define("nofo-alert-close", NofoAlertClose);

export {
  NofoAlert,
  NofoAlertIcon,
  NofoAlertContent,
  NofoAlertTitle,
  NofoAlertDescription,
  NofoAlertClose,
};
