import { NofoElement } from "../../index.js";

class NofoAlertDialog extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));
    if (this.state.defaultOpen) this.state.open = true;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoAlertDialogTrigger extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-alert-dialog");
    if (root) root.state.open = true;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `:host { display: contents; } div { display: contents; }`;
  }
}

class NofoAlertDialogPortal extends NofoElement {
  onMount() {
    const root = this.closest("nofo-alert-dialog");
    if (root) {
      this.effect(() => {
        this.style.display = root.state.open ? "block" : "none";
      });
    }
  }

  template() {
    return `<nofo-portal><slot></slot></nofo-portal>`;
  }

  styles() {
    return `:host { display: block; }`;
  }
}

class NofoAlertDialogOverlay extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-alert-dialog");
    if (root) root.state.open = false;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `
      :host {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 40;
      }
      div { width: 100%; height: 100%; }
    `;
  }
}

class NofoAlertDialogContent extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--color-panel-solid);
        padding: 1.5rem;
        border-radius: var(--radius);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        z-index: 50;
        width: 90vw;
        max-width: 500px;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAlertDialogTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--gray-12);
        margin-bottom: 0.5rem;
      }
    `;
  }
}

class NofoAlertDialogDescription extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        font-size: 0.875rem;
        color: var(--gray-11);
        margin-bottom: 1.5rem;
        line-height: 1.25rem;
      }
    `;
  }
}

class NofoAlertDialogCancel extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-alert-dialog");
    if (root) root.state.open = false;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `:host { display: contents; } div { display: contents; }`;
  }
}

class NofoAlertDialogAction extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-alert-dialog");
    if (root) root.state.open = false;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `:host { display: contents; } div { display: contents; }`;
  }
}

customElements.define("nofo-alert-dialog", NofoAlertDialog);
customElements.define("nofo-alert-dialog-trigger", NofoAlertDialogTrigger);
customElements.define("nofo-alert-dialog-portal", NofoAlertDialogPortal);
customElements.define("nofo-alert-dialog-overlay", NofoAlertDialogOverlay);
customElements.define("nofo-alert-dialog-content", NofoAlertDialogContent);
customElements.define("nofo-alert-dialog-title", NofoAlertDialogTitle);
customElements.define("nofo-alert-dialog-description", NofoAlertDialogDescription);
customElements.define("nofo-alert-dialog-cancel", NofoAlertDialogCancel);
customElements.define("nofo-alert-dialog-action", NofoAlertDialogAction);

export {
  NofoAlertDialog,
  NofoAlertDialogTrigger,
  NofoAlertDialogPortal,
  NofoAlertDialogOverlay,
  NofoAlertDialogContent,
  NofoAlertDialogTitle,
  NofoAlertDialogDescription,
  NofoAlertDialogCancel,
  NofoAlertDialogAction,
};
