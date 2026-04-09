import { NofoElement, useClickOutside } from "../../index.js";

class NofoPopover extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));

    this.addEventListener("popover-open", () => {
      this.state.open = true;
      this.dispatchEvent(
        new CustomEvent("open-change", { detail: { open: true }, bubbles: true, composed: true }),
      );
    });

    this.addEventListener("popover-close", () => {
      this.state.open = false;
      this.dispatchEvent(
        new CustomEvent("open-change", { detail: { open: false }, bubbles: true, composed: true }),
      );
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoPopoverTrigger extends NofoElement {
  onMount() {
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = this.closest("nofo-popover");
      if (parent) {
        parent.state.open = !parent.state.open;
        parent.dispatchEvent(
          new CustomEvent("open-change", {
            detail: { open: parent.state.open },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoPopoverContent extends NofoElement {
  static props = {
    size: "2",
    side: "bottom",
    align: "center",
    sideOffset: 5,
  };

  #clickOutsideCleanup = null;

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("side")
      .toDataAttr("side")
      .attr("align")
      .toDataAttr("align")
      .attr("sideOffset")
      .toDataAttr("side-offset");

    this.effect(() => {
      const parent = this.closest("nofo-popover");
      if (parent) {
        if (parent.state.open) {
          const { bind } = useClickOutside();
          this.#clickOutsideCleanup = bind(this, () => {
            if (parent.state.open) {
              parent.state.open = false;
              parent.dispatchEvent(
                new CustomEvent("open-change", {
                  detail: { open: false },
                  bubbles: true,
                  composed: true,
                }),
              );
            }
          });
        } else if (this.#clickOutsideCleanup) {
          this.#clickOutsideCleanup();
          this.#clickOutsideCleanup = null;
        }
      }
    });
  }

  onUnmount() {
    if (this.#clickOutsideCleanup) {
      this.#clickOutsideCleanup();
    }
  }

  getSizeStyles(size) {
    const sizes = {
      1: { padding: "0.5rem", maxWidth: "200px" },
      2: { padding: "0.75rem", maxWidth: "250px" },
      3: { padding: "1rem", maxWidth: "300px" },
      4: { padding: "1.5rem", maxWidth: "350px" },
    };
    return sizes[size] || sizes["2"];
  }

  getSideStyles(side, sideOffset) {
    const offset = parseInt(sideOffset) || 5;
    const sides = {
      top: { bottom: `calc(100% + ${offset}px)` },
      right: { left: `calc(100% + ${offset}px)` },
      bottom: { top: `calc(100% + ${offset}px)` },
      left: { right: `calc(100% + ${offset}px)` },
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
    const parent = this.closest("nofo-popover");
    const isOpen = parent && parent.state.open;
    if (!isOpen) return "";
    return `<slot></slot>`;
  }

  styles() {
    const parent = this.closest("nofo-popover");
    const isOpen = parent && parent.state.open;
    const sizeStyles = this.getSizeStyles(this.state.size);
    const sideStyles = this.getSideStyles(this.state.side, this.state.sideOffset);
    const alignStyles = this.getAlignStyles(this.state.align);

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

class NofoPopoverClose extends NofoElement {
  onMount() {
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = this.closest("nofo-popover");
      if (parent) {
        parent.state.open = false;
        parent.dispatchEvent(
          new CustomEvent("open-change", {
            detail: { open: false },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-popover", NofoPopover);
customElements.define("nofo-popover-trigger", NofoPopoverTrigger);
customElements.define("nofo-popover-content", NofoPopoverContent);
customElements.define("nofo-popover-close", NofoPopoverClose);

export { NofoPopover, NofoPopoverTrigger, NofoPopoverContent, NofoPopoverClose };
