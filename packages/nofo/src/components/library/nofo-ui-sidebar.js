import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISidebar extends NofoElement {
  static props() {
    return {
      open: { type: Boolean, attribute: "open" },
      side: { type: String, attribute: "side" },
      size: { type: String, attribute: "size" },
    };
  }

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
        
        nofo-drawer {
          --drawer-background: var(--nofo-ui-background-secondary);
          --drawer-border: var(--nofo-ui-border);
        }
      </style>
      <nofo-drawer>
        <slot></slot>
      </nofo-drawer>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._drawer = this.shadowRoot.querySelector("nofo-drawer");
    this.sync();
  }

  sync() {
    if (this._drawer) {
      if (this.open) {
        this._drawer.setAttribute("open", "");
      } else {
        this._drawer.removeAttribute("open");
      }

      const side = this.side || "left";
      this._drawer.setAttribute("side", side);

      const size = this.size || "md";
      this._drawer.setAttribute("size", size);
    }
  }
}

class NofoUISidebarTrigger extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
      </style>
      <nofo-drawer-trigger>
        <slot></slot>
      </nofo-drawer-trigger>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUISidebarContent extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
        
        nofo-drawer-content {
          background-color: var(--nofo-ui-background-secondary);
          border: 1px solid var(--nofo-ui-border);
          box-shadow: var(--nofo-ui-shadow-xl);
        }
      </style>
      <nofo-drawer-content>
        <slot></slot>
      </nofo-drawer-content>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUISidebarHeader extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-drawer-header {
          padding: var(--nofo-ui-spacing-xl);
          border-bottom: 1px solid var(--nofo-ui-border);
        }
      </style>
      <nofo-drawer-header>
        <slot></slot>
      </nofo-drawer-header>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUISidebarTitle extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-drawer-title {
          font-size: var(--nofo-ui-font-size-xl);
          font-weight: 600;
          color: var(--nofo-ui-foreground);
        }
      </style>
      <nofo-drawer-title>
        <slot></slot>
      </nofo-drawer-title>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUISidebarBody extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-drawer-body {
          padding: var(--nofo-ui-spacing-xl);
          overflow-y: auto;
        }
      </style>
      <nofo-drawer-body>
        <slot></slot>
      </nofo-drawer-body>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-sidebar", NofoUISidebar);
customElements.define("nofo-ui-sidebar-trigger", NofoUISidebarTrigger);
customElements.define("nofo-ui-sidebar-content", NofoUISidebarContent);
customElements.define("nofo-ui-sidebar-header", NofoUISidebarHeader);
customElements.define("nofo-ui-sidebar-title", NofoUISidebarTitle);
customElements.define("nofo-ui-sidebar-body", NofoUISidebarBody);
