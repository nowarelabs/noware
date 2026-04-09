import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIContextMenu extends NofoElement {
  template() {
    return `
      <nofo-context-menu>
        <slot></slot>
      </nofo-context-menu>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIContextMenuTrigger extends NofoElement {
  template() {
    return `
      <nofo-context-menu-trigger>
        <slot></slot>
      </nofo-context-menu-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIContextMenuContent extends NofoElement {
  template() {
    return `
      <nofo-context-menu-content>
        <slot></slot>
      </nofo-context-menu-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-context-menu-content {
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

class NofoUIContextMenuItem extends NofoElement {
  static props = {
    disabled: false,
    shortcut: "",
    color: "",
  };

  onMount() {
    this.sync()
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("shortcut")
      .toDataAttr("shortcut")
      .attr("color")
      .toDataAttr("color");
  }

  template() {
    return `
      <nofo-context-menu-item 
        ?disabled="${this.state.disabled}"
        shortcut="${this.state.shortcut}"
        color="${this.state.color}"
      >
        <slot></slot>
      </nofo-context-menu-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-context-menu-item {
        display: flex;
        align-items: center;
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        color: var(--nofo-ui-foreground);
        font-size: var(--nofo-ui-font-size-sm);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      nofo-context-menu-item:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-context-menu-item[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
  }
}

class NofoUIContextMenuSeparator extends NofoElement {
  template() {
    return `<nofo-context-menu-separator></nofo-context-menu-separator>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; margin: var(--nofo-ui-spacing-sm) 0; }
      nofo-context-menu-separator {
        display: block;
        height: 1px;
        background-color: var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUIContextMenuSub extends NofoElement {
  template() {
    return `<nofo-context-menu-sub><slot></slot></nofo-context-menu-sub>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoUIContextMenuSubTrigger extends NofoElement {
  template() {
    return `<nofo-context-menu-sub-trigger><slot></slot></nofo-context-menu-sub-trigger>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoUIContextMenuSubContent extends NofoElement {
  template() {
    return `<nofo-context-menu-sub-content><slot></slot></nofo-context-menu-sub-content>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-ui-context-menu", NofoUIContextMenu);
customElements.define("nofo-ui-context-menu-trigger", NofoUIContextMenuTrigger);
customElements.define("nofo-ui-context-menu-content", NofoUIContextMenuContent);
customElements.define("nofo-ui-context-menu-item", NofoUIContextMenuItem);
customElements.define("nofo-ui-context-menu-separator", NofoUIContextMenuSeparator);
customElements.define("nofo-ui-context-menu-sub", NofoUIContextMenuSub);
customElements.define("nofo-ui-context-menu-sub-trigger", NofoUIContextMenuSubTrigger);
customElements.define("nofo-ui-context-menu-sub-content", NofoUIContextMenuSubContent);

export {
  NofoUIContextMenu,
  NofoUIContextMenuTrigger,
  NofoUIContextMenuContent,
  NofoUIContextMenuItem,
  NofoUIContextMenuSeparator,
  NofoUIContextMenuSub,
  NofoUIContextMenuSubTrigger,
  NofoUIContextMenuSubContent,
};
