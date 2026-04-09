import { NofoElement, useTimeout } from "../../index.js";

class NofoHoverCard extends NofoElement {
  static props = {
    open: false,
    openDelay: 200,
    closeDelay: 300,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoHoverCardTrigger extends NofoElement {
  #openTimer = useTimeout();
  #closeTimer = useTimeout();

  onMount() {
    const root = this.closest("nofo-hover-card");
    if (!root) return;

    this.addEventListener("mouseenter", () => {
      this.#closeTimer.clear();
      this.#openTimer.set(() => {
        root.state.open = true;
      }, root.state.openDelay);
    });

    this.addEventListener("mouseleave", () => {
      this.#openTimer.clear();
      this.#closeTimer.set(() => {
        root.state.open = false;
      }, root.state.closeDelay);
    });
  }

  onUnmount() {
    this.#openTimer.clear();
    this.#closeTimer.clear();
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoHoverCardContent extends NofoElement {
  static props = {
    size: "2",
    side: "bottom",
    align: "center",
  };

  onMount() {
    const root = this.closest("nofo-hover-card");
    if (root) {
      this.effect(() => {
        this.setAttribute("data-state", root.state.open ? "open" : "closed");
      });
    }
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("side")
      .toDataAttr("side")
      .attr("align")
      .toDataAttr("align");
  }

  getSizeStyles(size) {
    const sizes = {
      1: { padding: "0.5rem", maxWidth: "200px" },
      2: { padding: "0.75rem", maxWidth: "250px" },
      3: { padding: "1rem", maxWidth: "300px" },
    };
    return sizes[size] || sizes["2"];
  }

  getSideStyles(side) {
    const sides = {
      top: { bottom: "calc(100% + 5px)" },
      right: { left: "calc(100% + 5px)" },
      bottom: { top: "calc(100% + 5px)" },
      left: { right: "calc(100% + 5px)" },
    };
    return sides[side] || sides["bottom"];
  }

  getAlignStyles(align) {
    const alignments = {
      start: { alignItems: "flex-start" },
      center: { alignItems: "center" },
      end: { alignItems: "flex-end" },
    };
    return alignments[align] || alignments["center"];
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const root = this.closest("nofo-hover-card");
    const isOpen = root && root.state.open;
    const size = this.state.size;
    const side = this.state.side;
    const align = this.state.align;

    const sizeStyles = this.getSizeStyles(size);
    const sideStyles = this.getSideStyles(side);
    const alignStyles = this.getAlignStyles(align);

    return `
      :host {
        position: absolute;
        background-color: var(--color-panel-solid);
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        padding: ${sizeStyles.padding};
        max-width: ${sizeStyles.maxWidth};
        z-index: 50;
        display: ${isOpen ? "block" : "none"};
        box-sizing: border-box;
        ${Object.entries(sideStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
        ${Object.entries(alignStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      }
    `;
  }
}

customElements.define("nofo-hover-card", NofoHoverCard);
customElements.define("nofo-hover-card-trigger", NofoHoverCardTrigger);
customElements.define("nofo-hover-card-content", NofoHoverCardContent);

export { NofoHoverCard, NofoHoverCardTrigger, NofoHoverCardContent };
