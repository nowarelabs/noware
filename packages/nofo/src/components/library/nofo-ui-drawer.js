import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIDrawer extends NofoElement {
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
      <nofo-ui-sheet 
        ?open="${this.state.open}" 
        side="${this.state.side}" 
        size="${this.state.size}"
      >
        <slot></slot>
      </nofo-ui-sheet>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIDrawerTrigger extends NofoElement {
  template() {
    return `<nofo-ui-sheet-trigger><slot></slot></nofo-ui-sheet-trigger>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoUIDrawerContent extends NofoElement {
  template() {
    return `<nofo-ui-sheet-content><slot></slot></nofo-ui-sheet-content>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoUIDrawerHeader extends NofoElement {
  template() {
    return `<nofo-ui-sheet-header><slot></slot></nofo-ui-sheet-header>`;
  }
  styles() {
    return `:host { display: block; }`;
  }
}

class NofoUIDrawerTitle extends NofoElement {
  template() {
    return `<nofo-ui-sheet-title><slot></slot></nofo-ui-sheet-title>`;
  }
  styles() {
    return `:host { display: block; }`;
  }
}

class NofoUIDrawerBody extends NofoElement {
  template() {
    return `<nofo-ui-sheet-body><slot></slot></nofo-ui-sheet-body>`;
  }
  styles() {
    return `:host { display: block; }`;
  }
}

class NofoUIDrawerClose extends NofoElement {
  template() {
    return `<nofo-ui-sheet-close><slot></slot></nofo-ui-sheet-close>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-ui-drawer", NofoUIDrawer);
customElements.define("nofo-ui-drawer-trigger", NofoUIDrawerTrigger);
customElements.define("nofo-ui-drawer-content", NofoUIDrawerContent);
customElements.define("nofo-ui-drawer-header", NofoUIDrawerHeader);
customElements.define("nofo-ui-drawer-title", NofoUIDrawerTitle);
customElements.define("nofo-ui-drawer-body", NofoUIDrawerBody);
customElements.define("nofo-ui-drawer-close", NofoUIDrawerClose);

export {
  NofoUIDrawer,
  NofoUIDrawerTrigger,
  NofoUIDrawerContent,
  NofoUIDrawerHeader,
  NofoUIDrawerTitle,
  NofoUIDrawerBody,
  NofoUIDrawerClose,
};
