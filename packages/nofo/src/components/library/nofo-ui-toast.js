import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIToastProvider extends NofoElement {
  template() {
    return `
      <nofo-toast-group>
        <slot></slot>
      </nofo-toast-group>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-toast-group {
        position: fixed;
        top: 0;
        right: 0;
        z-index: var(--nofo-ui-z-tooltip);
        padding: var(--nofo-ui-spacing-lg);
        display: flex;
        flex-direction: column;
        gap: var(--nofo-ui-spacing-md);
      }
    `;
  }
}

class NofoUIToast extends NofoElement {
  static props = {
    title: "",
    description: "",
    variant: "default",
    open: false,
    duration: 5000,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open").attr("duration").toDataAttr("duration");
  }

  getSystemVariant(variant) {
    const map = {
      default: "default",
      destructive: "error",
      success: "success",
    };
    return map[variant] || "default";
  }

  template() {
    const systemVariant = this.getSystemVariant(this.state.variant);
    return `
      <nofo-toast variant="${systemVariant}" ${this.state.open ? "open" : ""} duration="${this.state.duration}">
        <slot></slot>
      </nofo-toast>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-toast {
        display: flex;
        flex-direction: column;
        gap: var(--nofo-ui-spacing-sm);
        padding: var(--nofo-ui-spacing-lg);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
        min-width: 20rem;
        max-width: 24rem;
        animation: slideInRight 0.3s ease;
      }
      
      :host([variant="destructive"]) nofo-toast {
        border-color: var(--nofo-ui-destructive, #ff0033);
        background-color: rgba(255, 0, 51, 0.1);
      }
      
      :host([variant="success"]) nofo-toast {
        border-color: var(--nofo-ui-success, #00ff41);
        background-color: rgba(0, 255, 65, 0.1);
      }
      
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
  }
}

class NofoUIToastTitle extends NofoElement {
  template() {
    return `
      <nofo-toast-title>
        <slot></slot>
      </nofo-toast-title>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-toast-title {
        font-size: var(--nofo-ui-font-size-base);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIToastDescription extends NofoElement {
  template() {
    return `
      <nofo-toast-description>
        <slot></slot>
      </nofo-toast-description>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-toast-description {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

class NofoUIToastClose extends NofoElement {
  template() {
    return `
      <nofo-toast-close>
        <slot></slot>
      </nofo-toast-close>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-toast-close {
        position: absolute;
        top: var(--nofo-ui-spacing-sm);
        right: var(--nofo-ui-spacing-sm);
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }
      nofo-toast-close:hover { opacity: 1; }
    `;
  }
}

customElements.define("nofo-ui-toast-provider", NofoUIToastProvider);
customElements.define("nofo-ui-toast", NofoUIToast);
customElements.define("nofo-ui-toast-title", NofoUIToastTitle);
customElements.define("nofo-ui-toast-description", NofoUIToastDescription);
customElements.define("nofo-ui-toast-close", NofoUIToastClose);

export {
  NofoUIToastProvider,
  NofoUIToast,
  NofoUIToastTitle,
  NofoUIToastDescription,
  NofoUIToastClose,
};
