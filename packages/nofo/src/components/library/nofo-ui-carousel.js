import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICarousel extends NofoElement {
  static props = {
    value: "",
    defaultValue: "",
    loop: false,
    autoplay: false,
    interval: "5000",
    orientation: "horizontal",
  };

  template() {
    const { value, defaultValue, loop, autoplay, interval, orientation } = this.state;

    return `
      <nofo-carousel
        value="${value}"
        defaultValue="${defaultValue}"
        ?loop="${loop}"
        ?autoplay="${autoplay}"
        interval="${interval}"
        orientation="${orientation}"
      >
        <slot></slot>
      </nofo-carousel>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: block;
        width: 100%;
        position: relative;
      }
      
      nofo-carousel {
        display: block;
        width: 100%;
      }
    `;
  }
}

class NofoUICarouselViewport extends NofoElement {
  template() {
    return `
      <nofo-carousel-viewport>
        <slot></slot>
      </nofo-carousel-viewport>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselContent extends NofoElement {
  template() {
    return `
      <nofo-carousel-content>
        <slot></slot>
      </nofo-carousel-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselItem extends NofoElement {
  template() {
    return `
      <nofo-carousel-item>
        <slot></slot>
      </nofo-carousel-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselPrevious extends NofoElement {
  template() {
    return `
      <nofo-carousel-previous>
        <slot></slot>
      </nofo-carousel-previous>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselNext extends NofoElement {
  template() {
    return `
      <nofo-carousel-next>
        <slot></slot>
      </nofo-carousel-next>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselIndicators extends NofoElement {
  template() {
    return `
      <nofo-carousel-indicators>
        <slot></slot>
      </nofo-carousel-indicators>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: contents;
      }
    `;
  }
}

class NofoUICarouselIndicator extends NofoElement {
  static props = {
    value: "",
    dataActive: false,
  };

  template() {
    const { value, dataActive } = this.state;

    return `
      <nofo-carousel-indicator 
        value="${value}" 
        ?data-active="${dataActive}"
      ></nofo-carousel-indicator>
    `;
  }

  styles() {
    const { dataActive } = this.state;
    const isActive = dataActive;

    return `
      ${nofoUIStyles}
      
      :host {
        display: inline-block;
      }
      
      nofo-carousel-indicator {
        width: ${isActive ? "2rem" : "0.5rem"};
        height: 0.5rem;
        border-radius: 9999px;
        background-color: ${isActive ? "var(--nofo-ui-accent-primary)" : "var(--nofo-ui-border)"};
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      nofo-carousel-indicator:hover {
        background-color: var(--nofo-ui-accent-primary);
      }
    `;
  }
}

customElements.define("nofo-ui-carousel", NofoUICarousel);
customElements.define("nofo-ui-carousel-viewport", NofoUICarouselViewport);
customElements.define("nofo-ui-carousel-content", NofoUICarouselContent);
customElements.define("nofo-ui-carousel-item", NofoUICarouselItem);
customElements.define("nofo-ui-carousel-previous", NofoUICarouselPrevious);
customElements.define("nofo-ui-carousel-next", NofoUICarouselNext);
customElements.define("nofo-ui-carousel-indicators", NofoUICarouselIndicators);
customElements.define("nofo-ui-carousel-indicator", NofoUICarouselIndicator);
