import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIAlertDialog extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));
  }

  template() {
    return `
      <nofo-alert-dialog ?open="${this.state.open}">
        <slot></slot>
      </nofo-alert-dialog>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIAlertDialogTrigger extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-trigger>
        <slot></slot>
      </nofo-alert-dialog-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIAlertDialogContent extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-content>
        <slot></slot>
      </nofo-alert-dialog-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-alert-dialog-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-xl);
        color: var(--nofo-ui-foreground);
        max-width: 32rem;
        width: 100%;
      }
    `;
  }
}

class NofoUIAlertDialogHeader extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-header>
        <slot></slot>
      </nofo-alert-dialog-header>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-alert-dialog-header {
        display: flex;
        flex-direction: column;
        padding: var(--nofo-ui-spacing-xl);
        padding-bottom: var(--nofo-ui-spacing-lg);
      }
    `;
  }
}

class NofoUIAlertDialogTitle extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-title>
        <slot></slot>
      </nofo-alert-dialog-title>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-alert-dialog-title {
        font-size: var(--nofo-ui-font-size-xl);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIAlertDialogDescription extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-description>
        <slot></slot>
      </nofo-alert-dialog-description>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        margin-top: var(--nofo-ui-spacing-sm);
      }
      nofo-alert-dialog-description {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

class NofoUIAlertDialogFooter extends NofoElement {
  template() {
    return `
      <nofo-alert-dialog-footer>
        <slot></slot>
      </nofo-alert-dialog-footer>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-alert-dialog-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--nofo-ui-spacing-md);
        padding: var(--nofo-ui-spacing-xl);
        padding-top: var(--nofo-ui-spacing-lg);
        border-top: 1px solid var(--nofo-ui-border);
      }
    `;
  }
}

customElements.define("nofo-ui-alert-dialog", NofoUIAlertDialog);
customElements.define("nofo-ui-alert-dialog-trigger", NofoUIAlertDialogTrigger);
customElements.define("nofo-ui-alert-dialog-content", NofoUIAlertDialogContent);
customElements.define("nofo-ui-alert-dialog-header", NofoUIAlertDialogHeader);
customElements.define("nofo-ui-alert-dialog-title", NofoUIAlertDialogTitle);
customElements.define("nofo-ui-alert-dialog-description", NofoUIAlertDialogDescription);
customElements.define("nofo-ui-alert-dialog-footer", NofoUIAlertDialogFooter);

export {
  NofoUIAlertDialog,
  NofoUIAlertDialogTrigger,
  NofoUIAlertDialogContent,
  NofoUIAlertDialogHeader,
  NofoUIAlertDialogTitle,
  NofoUIAlertDialogDescription,
  NofoUIAlertDialogFooter,
};
