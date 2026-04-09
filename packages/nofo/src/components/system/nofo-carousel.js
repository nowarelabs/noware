import { NofoElement, useInterval } from "../../index.js";

class NofoCarousel extends NofoElement {
  static props = {
    value: 0,
    defaultValue: 0,
    loop: false,
    autoplay: false,
    interval: 3000,
    orientation: "horizontal",
  };

  #internalValue = 0;
  #autoplayTimer = useInterval();

  constructor() {
    super();
  }

  get _internalValue() {
    return this.#internalValue;
  }

  set _internalValue(val) {
    this.#internalValue = val;
  }

  onMount() {
    if (this.defaultValue !== undefined) {
      this.#internalValue = this.defaultValue;
    }
    if (this.value !== undefined) {
      this.#internalValue = this.value;
    }

    this.updateCarousel();
    this.setupEventListeners();
    this.startAutoplay();
  }

  onUnmount() {
    this.stopAutoplay();
  }

  setupEventListeners() {
    const previous = this.querySelector("nofo-carousel-previous");
    const next = this.querySelector("nofo-carousel-next");

    if (previous) {
      previous.addEventListener("click", () => {
        this.previous();
      });
    }

    if (next) {
      next.addEventListener("click", () => {
        this.next();
      });
    }

    this.addEventListener("click", (e) => {
      const indicator = e.target.closest("nofo-carousel-indicator");
      if (!indicator) return;

      const value = parseInt(indicator.getAttribute("value")) || 0;
      this.goToSlide(value);
    });

    this.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        this.previous();
      } else if (e.key === "ArrowRight") {
        this.next();
      }
    });
  }

  getSlideCount() {
    return this.querySelectorAll("nofo-carousel-item").length;
  }

  previous() {
    const slideCount = this.getSlideCount();

    if (this._internalValue > 0) {
      this._internalValue--;
    } else if (this.loop) {
      this._internalValue = slideCount - 1;
    }

    this.goToSlide(this._internalValue);
  }

  next() {
    const slideCount = this.getSlideCount();

    if (this._internalValue < slideCount - 1) {
      this._internalValue++;
    } else if (this.loop) {
      this._internalValue = 0;
    }

    this.goToSlide(this._internalValue);
  }

  goToSlide(index) {
    const slideCount = this.getSlideCount();
    this._internalValue = Math.max(0, Math.min(slideCount - 1, index));

    this.attr("value", this._internalValue);

    const event = new CustomEvent("value-change", {
      detail: { value: this._internalValue },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);

    this.updateCarousel();
  }

  updateCarousel() {
    const content = this.querySelector("nofo-carousel-content");

    if (content) {
      const slideCount = this.getSlideCount();
      const translate =
        this.orientation === "horizontal"
          ? `translateX(-${this._internalValue * 100}%)`
          : `translateY(-${this._internalValue * 100}%)`;

      content.style.transform = translate;
    }

    const indicators = this.querySelectorAll("nofo-carousel-indicator");
    indicators.forEach((indicator, index) => {
      if (index === this._internalValue) {
        indicator.setAttribute("data-active", "");
      } else {
        indicator.removeAttribute("data-active");
      }
    });

    const previous = this.querySelector("nofo-carousel-previous");
    const next = this.querySelector("nofo-carousel-next");
    const slideCount = this.getSlideCount();

    if (previous) {
      if (this._internalValue === 0 && !this.loop) {
        previous.setAttribute("disabled", "");
      } else {
        previous.removeAttribute("disabled");
      }
    }

    if (next) {
      if (this._internalValue === slideCount - 1 && !this.loop) {
        next.setAttribute("disabled", "");
      } else {
        next.removeAttribute("disabled");
      }
    }
  }

  startAutoplay() {
    this.#autoplayTimer.clear();

    if (!this.autoplay) return;

    this.#autoplayTimer.set(() => {
      this.next();
    }, this.interval);
  }

  stopAutoplay() {
    this.#autoplayTimer.clear();
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        position: relative;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCarouselViewport extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        position: relative;
        overflow: hidden;
        width: 100%;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCarouselContent extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const carousel = this.closest("nofo-carousel");
    const orientation = carousel
      ? carousel.getAttribute("orientation") || "horizontal"
      : "horizontal";

    return `
      :host {
        display: flex;
        flex-direction: ${orientation === "vertical" ? "column" : "row"};
        transition: transform 0.3s ease;
        will-change: transform;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCarouselItem extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const carousel = this.closest("nofo-carousel");
    const orientation = carousel
      ? carousel.getAttribute("orientation") || "horizontal"
      : "horizontal";

    return `
      :host {
        flex: 0 0 100%;
        width: ${orientation === "horizontal" ? "100%" : "auto"};
        height: ${orientation === "vertical" ? "100%" : "auto"};
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCarouselPrevious extends NofoElement {
  static props = {
    disabled: false,
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    if (this.disabled) {
      this.dataset.disabled = "";
    } else {
      delete this.dataset.disabled;
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        box-sizing: border-box;
      }
      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoCarouselNext extends NofoElement {
  static props = {
    disabled: false,
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    if (this.disabled) {
      this.dataset.disabled = "";
    } else {
      delete this.dataset.disabled;
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        box-sizing: border-box;
      }
      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoCarouselIndicators extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        justify-content: center;
        gap: var(--space-2);
        padding: 1rem;
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCarouselIndicator extends NofoElement {
  static props = {
    value: 0,
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    if (this.has("data-active")) {
      this.dataset.active = "";
    }
  }

  template() {
    return `<button type="button" aria-label="Go to slide"></button>`;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background-color: var(--gray-6);
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        padding: 0;
      }
      :host([data-active]) {
        width: 2rem;
        background-color: var(--accent-9);
      }
      :host(:hover) {
        background-color: var(--accent-7);
      }
    `;
  }
}

customElements.define("nofo-carousel", NofoCarousel);
customElements.define("nofo-carousel-viewport", NofoCarouselViewport);
customElements.define("nofo-carousel-content", NofoCarouselContent);
customElements.define("nofo-carousel-item", NofoCarouselItem);
customElements.define("nofo-carousel-previous", NofoCarouselPrevious);
customElements.define("nofo-carousel-next", NofoCarouselNext);
customElements.define("nofo-carousel-indicators", NofoCarouselIndicators);
customElements.define("nofo-carousel-indicator", NofoCarouselIndicator);

export {
  NofoCarousel,
  NofoCarouselViewport,
  NofoCarouselContent,
  NofoCarouselItem,
  NofoCarouselPrevious,
  NofoCarouselNext,
  NofoCarouselIndicators,
  NofoCarouselIndicator,
};
