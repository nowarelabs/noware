import { NofoElement, useTimeout } from "../../index.js";

class NofoTooltip extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
    delayDuration: 700,
    skipDelayDuration: 300,
    disableHoverableContent: false,
  };

  #openTimer = useTimeout();
  #closeTimer = useTimeout();

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));

    if (this.state.defaultOpen) {
      this.state.open = true;
    }

    const trigger = this.querySelector("nofo-tooltip-trigger");
    if (trigger) {
      trigger.addEventListener("mouseenter", () => {
        this.#closeTimer.clear();

        this.#openTimer.set(() => {
          this.state.open = true;
          this.dispatchEvent(
            new CustomEvent("open-change", {
              detail: { open: true },
              bubbles: true,
              composed: true,
            }),
          );
        }, this.state.delayDuration);
      });

      trigger.addEventListener("mouseleave", () => {
        this.#openTimer.clear();

        this.#closeTimer.set(() => {
          this.state.open = false;
          this.dispatchEvent(
            new CustomEvent("open-change", {
              detail: { open: false },
              bubbles: true,
              composed: true,
            }),
          );
        }, this.state.skipDelayDuration);
      });
    }
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

class NofoTooltipTrigger extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoTooltipContent extends NofoElement {
  static props = {
    side: "top",
    align: "center",
    sideOffset: 5,
    alignOffset: 0,
  };

  onMount() {
    this.sync().attr("side").toDataAttr("side").attr("align").toDataAttr("align");
  }

  getSideStyles(side, sideOffset) {
    const offset = parseInt(sideOffset) || 5;
    const sides = {
      top: { bottom: `calc(100% + ${offset}px)` },
      right: { left: `calc(100% + ${offset}px)` },
      bottom: { top: `calc(100% + ${offset}px)` },
      left: { right: `calc(100% + ${offset}px)` },
    };
    return sides[side] || sides["top"];
  }

  template() {
    const parent = this.closest("nofo-tooltip");
    const isOpen = parent && parent.state.open;
    if (!isOpen) return "";
    return `<slot></slot>`;
  }

  styles() {
    const parent = this.closest("nofo-tooltip");
    const isOpen = parent && parent.state.open;
    const sideStyles = this.getSideStyles(this.state.side, this.state.sideOffset);

    return `
      :host {
        position: absolute;
        background-color: var(--gray-12);
        color: var(--gray-1);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        font-size: 0.875rem;
        z-index: 100;
        display: ${isOpen ? "block" : "none"};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        maxWidth: 300px;
        box-sizing: border-box;
        ${Object.entries(sideStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      }
    `;
  }
}

class NofoTooltipArrow extends NofoElement {
  template() {
    return "";
  }

  styles() {
    return `
      :host {
        position: absolute;
        width: 0;
        height: 0;
        border: 4px solid transparent;
        box-sizing: border-box;
      }
      :host::before {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border: 4px solid transparent;
      }
    `;
  }
}

customElements.define("nofo-tooltip", NofoTooltip);
customElements.define("nofo-tooltip-trigger", NofoTooltipTrigger);
customElements.define("nofo-tooltip-content", NofoTooltipContent);
customElements.define("nofo-tooltip-arrow", NofoTooltipArrow);

export { NofoTooltip, NofoTooltipTrigger, NofoTooltipContent, NofoTooltipArrow };
