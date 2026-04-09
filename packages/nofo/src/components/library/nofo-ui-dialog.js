import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIDialog extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open");
  }

  template() {
    return `
      <nofo-dialog ${this.state.open ? "open" : ""}>
        <slot></slot>
      </nofo-dialog>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-dialog {
        --dialog-background: var(--nofo-ui-background-secondary);
        --dialog-border: var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUIDialogTrigger extends NofoElement {
  template() {
    return `
      <nofo-dialog-trigger>
        <slot></slot>
      </nofo-dialog-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIDialogContent extends NofoElement {
  template() {
    return `
      <nofo-dialog-content>
        <slot></slot>
      </nofo-dialog-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-dialog-content {
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

class NofoUIDialogHeader extends NofoElement {
  template() {
    return `
      <nofo-dialog-header>
        <slot></slot>
      </nofo-dialog-header>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-dialog-header {
        display: flex;
        flex-direction: column;
        padding: var(--nofo-ui-spacing-xl);
        padding-bottom: var(--nofo-ui-spacing-lg);
      }
    `;
  }
}

class NofoUIDialogTitle extends NofoElement {
  template() {
    return `
      <nofo-dialog-title>
        <slot></slot>
      </nofo-dialog-title>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-dialog-title {
        font-size: var(--nofo-ui-font-size-xl);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIDialogDescription extends NofoElement {
  template() {
    return `
      <nofo-dialog-description>
        <slot></slot>
      </nofo-dialog-description>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        margin-top: var(--nofo-ui-spacing-sm);
      }
      nofo-dialog-description {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

class NofoUIDialogBody extends NofoElement {
  template() {
    return `
      <nofo-dialog-body>
        <slot></slot>
      </nofo-dialog-body>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-dialog-body {
        padding: var(--nofo-ui-spacing-xl);
        padding-top: var(--nofo-ui-spacing-lg);
      }
    `;
  }
}

class NofoUIDialogFooter extends NofoElement {
  template() {
    return `
      <nofo-dialog-footer>
        <slot></slot>
      </nofo-dialog-footer>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-dialog-footer {
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

customElements.define("nofo-ui-dialog", NofoUIDialog);
customElements.define("nofo-ui-dialog-trigger", NofoUIDialogTrigger);
customElements.define("nofo-ui-dialog-content", NofoUIDialogContent);
customElements.define("nofo-ui-dialog-header", NofoUIDialogHeader);
customElements.define("nofo-ui-dialog-title", NofoUIDialogTitle);
customElements.define("nofo-ui-dialog-description", NofoUIDialogDescription);
customElements.define("nofo-ui-dialog-body", NofoUIDialogBody);
customElements.define("nofo-ui-dialog-footer", NofoUIDialogFooter);

export {
  NofoUIDialog,
  NofoUIDialogTrigger,
  NofoUIDialogContent,
  NofoUIDialogHeader,
  NofoUIDialogTitle,
  NofoUIDialogDescription,
  NofoUIDialogBody,
  NofoUIDialogFooter,
};
