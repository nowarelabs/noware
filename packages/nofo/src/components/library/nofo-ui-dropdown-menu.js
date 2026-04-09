import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIDropdownMenu extends NofoElement {
  template() {
    return `
      <nofo-dropdown-menu>
        <slot></slot>
      </nofo-dropdown-menu>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIDropdownMenuTrigger extends NofoElement {
  template() {
    return `
      <nofo-dropdown-menu-trigger>
        <slot></slot>
      </nofo-dropdown-menu-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIDropdownMenuContent extends NofoElement {
  template() {
    return `
      <nofo-dropdown-menu-content>
        <slot></slot>
      </nofo-dropdown-menu-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-dropdown-menu-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
        padding: var(--nofo-ui-spacing-sm);
        min-width: 12rem;
        z-index: var(--nofo-ui-z-dropdown);
      }
    `;
  }
}

class NofoUIDropdownMenuItem extends NofoElement {
  static props = {
    disabled: false,
  };

  onMount() {
    this.sync().attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-dropdown-menu-item ${this.state.disabled ? "disabled" : ""}>
        <slot></slot>
      </nofo-dropdown-menu-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-dropdown-menu-item {
        display: flex;
        align-items: center;
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        color: var(--nofo-ui-foreground);
        font-size: var(--nofo-ui-font-size-sm);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      nofo-dropdown-menu-item:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-dropdown-menu-item[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
  }
}

class NofoUIDropdownMenuSeparator extends NofoElement {
  template() {
    return `<nofo-dropdown-menu-separator></nofo-dropdown-menu-separator>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        height: 1px;
        background-color: var(--nofo-ui-border);
        margin: var(--nofo-ui-spacing-sm) 0;
      }
    `;
  }
}

customElements.define("nofo-ui-dropdown-menu", NofoUIDropdownMenu);
customElements.define("nofo-ui-dropdown-menu-trigger", NofoUIDropdownMenuTrigger);
customElements.define("nofo-ui-dropdown-menu-content", NofoUIDropdownMenuContent);
customElements.define("nofo-ui-dropdown-menu-item", NofoUIDropdownMenuItem);
customElements.define("nofo-ui-dropdown-menu-separator", NofoUIDropdownMenuSeparator);

export {
  NofoUIDropdownMenu,
  NofoUIDropdownMenuTrigger,
  NofoUIDropdownMenuContent,
  NofoUIDropdownMenuItem,
  NofoUIDropdownMenuSeparator,
};
