import { NofoElement } from "../../index.js";

class NofoDrawer extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
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

    if (this.state.defaultOpen) {
      this.state.open = true;
    }

    this.effect(() => {
      if (this.state.open) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    });
  }

  onUnmount() {
    document.body.style.overflow = "";
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoDrawerTrigger extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-drawer");
    if (root) root.state.open = true;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `:host { display: contents; } div { display: contents; }`;
  }
}

class NofoDrawerPortal extends NofoElement {
  template() {
    return `<nofo-portal><slot></slot></nofo-portal>`;
  }

  styles() {
    return `:host { display: block; }`;
  }
}

class NofoDrawerOverlay extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-drawer");
    if (root) root.state.open = false;
  }

  template() {
    return `<div on-click="handleClick"></div>`;
  }

  styles() {
    const root = this.closest("nofo-drawer");
    const isOpen = root && root.state.open;

    return `
      :host {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 40;
        display: ${isOpen ? "block" : "none"};
        animation: ${isOpen ? "fadeIn 0.2s ease" : "none"};
        box-sizing: border-box;
      }
      div { width: 100%; height: 100%; }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
  }
}

class NofoDrawerContent extends NofoElement {
  onMount() {
    const root = this.closest("nofo-drawer");
    if (root) {
      this.effect(() => {
        this.setAttribute("data-state", root.state.open ? "open" : "closed");
        this.setAttribute("data-side", root.state.side);
        this.setAttribute("data-size", root.state.size);
      });
    }
  }

  getSizeStyles(size) {
    const sizes = {
      sm: { width: "300px", height: "auto" },
      md: { width: "400px", height: "auto" },
      lg: { width: "500px", height: "auto" },
      xl: { width: "600px", height: "auto" },
      full: { width: "100vw", height: "100vh" },
    };
    return sizes[size] || sizes["md"];
  }

  getSideStyles(side, isOpen) {
    const sides = {
      left: {
        left: 0,
        top: 0,
        bottom: 0,
        right: "auto",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      },
      right: {
        right: 0,
        top: 0,
        bottom: 0,
        left: "auto",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
      },
      top: {
        top: 0,
        left: 0,
        right: 0,
        bottom: "auto",
        transform: isOpen ? "translateY(0)" : "translateY(-100%)",
      },
      bottom: {
        bottom: 0,
        left: 0,
        right: 0,
        top: "auto",
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
      },
    };
    return sides[side] || sides["right"];
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const root = this.closest("nofo-drawer");
    const isOpen = root && root.state.open;
    const side = root ? root.state.side : "right";
    const size = root ? root.state.size : "md";

    const sizeStyles = this.getSizeStyles(size);
    const sideStyles = this.getSideStyles(side, isOpen);

    return `
      :host {
        position: fixed;
        background-color: var(--color-panel-solid);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        z-index: 50;
        display: flex;
        flex-direction: column;
        transition: transform 0.3s ease;
        box-sizing: border-box;
        ${Object.entries(sizeStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
        ${Object.entries(sideStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      }
    `;
  }
}

class NofoDrawerHeader extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--gray-6);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDrawerTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--gray-12);
        margin: 0;
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDrawerBody extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDrawerFooter extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        padding: 1.5rem;
        border-top: 1px solid var(--gray-6);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDrawerClose extends NofoElement {
  handleClick() {
    const root = this.closest("nofo-drawer");
    if (root) root.state.open = false;
  }

  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }

  styles() {
    return `:host { display: contents; } div { display: contents; }`;
  }
}

customElements.define("nofo-drawer", NofoDrawer);
customElements.define("nofo-drawer-trigger", NofoDrawerTrigger);
customElements.define("nofo-drawer-portal", NofoDrawerPortal);
customElements.define("nofo-drawer-overlay", NofoDrawerOverlay);
customElements.define("nofo-drawer-content", NofoDrawerContent);
customElements.define("nofo-drawer-header", NofoDrawerHeader);
customElements.define("nofo-drawer-title", NofoDrawerTitle);
customElements.define("nofo-drawer-body", NofoDrawerBody);
customElements.define("nofo-drawer-footer", NofoDrawerFooter);
customElements.define("nofo-drawer-close", NofoDrawerClose);

export {
  NofoDrawer,
  NofoDrawerTrigger,
  NofoDrawerPortal,
  NofoDrawerOverlay,
  NofoDrawerContent,
  NofoDrawerHeader,
  NofoDrawerTitle,
  NofoDrawerBody,
  NofoDrawerFooter,
  NofoDrawerClose,
};
