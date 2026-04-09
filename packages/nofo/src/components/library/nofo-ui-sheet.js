import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISheet extends NofoElement {
  static props = {
    open: false,
    side: "right",
    size: "md",
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"))
      .attr("side")
      .toDataAttr("side")
      .attr("size")
      .toDataAttr("size");
  }

  template() {
    return `
      <nofo-drawer 
        ?open="${this.state.open}" 
        side="${this.state.side}" 
        size="${this.state.size}"
      >
        <slot></slot>
      </nofo-drawer>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-drawer {
        --drawer-background: var(--nofo-ui-background-secondary);
        --drawer-border: var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUISheetTrigger extends NofoElement {
  template() {
    return `
      <nofo-drawer-trigger>
        <slot></slot>
      </nofo-drawer-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUISheetContent extends NofoElement {
  template() {
    return `
      <nofo-drawer-content>
        <slot></slot>
      </nofo-drawer-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-drawer-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        box-shadow: var(--nofo-ui-shadow-xl);
        color: var(--nofo-ui-foreground);
      }
    `;
  }
}

class NofoUISheetHeader extends NofoElement {
  template() {
    return `
      <nofo-drawer-header>
        <slot></slot>
      </nofo-drawer-header>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--nofo-ui-spacing-xl);
        border-bottom: 1px solid var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUISheetTitle extends NofoElement {
  template() {
    return `
      <nofo-drawer-title>
        <slot></slot>
      </nofo-drawer-title>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-drawer-title {
        font-size: var(--nofo-ui-font-size-xl);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUISheetBody extends NofoElement {
  template() {
    return `
      <nofo-drawer-body>
        <slot></slot>
      </nofo-drawer-body>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-drawer-body {
        padding: var(--nofo-ui-spacing-xl);
        overflow-y: auto;
      }
    `;
  }
}

class NofoUISheetClose extends NofoElement {
  template() {
    return `
      <nofo-drawer-close>
        <slot></slot>
      </nofo-drawer-close>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

customElements.define("nofo-ui-sheet", NofoUISheet);
customElements.define("nofo-ui-sheet-trigger", NofoUISheetTrigger);
customElements.define("nofo-ui-sheet-content", NofoUISheetContent);
customElements.define("nofo-ui-sheet-header", NofoUISheetHeader);
customElements.define("nofo-ui-sheet-title", NofoUISheetTitle);
customElements.define("nofo-ui-sheet-body", NofoUISheetBody);
customElements.define("nofo-ui-sheet-close", NofoUISheetClose);

export {
  NofoUISheet,
  NofoUISheetTrigger,
  NofoUISheetContent,
  NofoUISheetHeader,
  NofoUISheetTitle,
  NofoUISheetBody,
  NofoUISheetClose,
};
