import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIMenubar extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: flex;
        align-items: center;
        gap: var(--nofo-ui-spacing-sm);
        padding: var(--nofo-ui-spacing-sm);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
      }
    `;
  }
}

class NofoUIMenubarMenu extends NofoElement {
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
      nofo-dropdown-menu { display: inline-block; }
    `;
  }
}

class NofoUIMenubarTrigger extends NofoElement {
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
      nofo-dropdown-menu-trigger {
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        font-size: var(--nofo-ui-font-size-sm);
        font-weight: 500;
        color: var(--nofo-ui-foreground);
        background-color: transparent;
        border: none;
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      nofo-dropdown-menu-trigger:hover {
        background-color: var(--nofo-ui-hover);
      }
    `;
  }
}

class NofoUIMenubarContent extends NofoElement {
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
    `;
  }
}

class NofoUIMenubarItem extends NofoElement {
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
    `;
  }
}

customElements.define("nofo-ui-menubar", NofoUIMenubar);
customElements.define("nofo-ui-menubar-menu", NofoUIMenubarMenu);
customElements.define("nofo-ui-menubar-trigger", NofoUIMenubarTrigger);
customElements.define("nofo-ui-menubar-content", NofoUIMenubarContent);
customElements.define("nofo-ui-menubar-item", NofoUIMenubarItem);

export {
  NofoUIMenubar,
  NofoUIMenubarMenu,
  NofoUIMenubarTrigger,
  NofoUIMenubarContent,
  NofoUIMenubarItem,
};
