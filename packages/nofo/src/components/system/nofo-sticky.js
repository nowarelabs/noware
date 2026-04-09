import { NofoElement } from "../../index.js";

class NofoSticky extends NofoElement {
  static props = {
    top: { type: String, default: "0" },
    bottom: { type: String, default: "auto" },
    zIndex: { type: String, default: "10" },
  };

  _observer = null;

  onMount() {
    this.setupIntersectionObserver();
    this.updateDataAttributes();
  }

  onUnmount() {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  onUpdate() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    this.setAttribute("data-top", this.props.top);
    this.setAttribute("data-bottom", this.props.bottom);
  }

  setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: 0,
    };

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.setAttribute("data-stuck", "false");
        } else {
          this.setAttribute("data-stuck", "true");
        }
      });
    }, options);

    this._observer.observe(this);
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: sticky;
        top: ${this.props.top};
        bottom: ${this.props.bottom};
        z-index: ${this.props.zIndex};
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

customElements.define("nofo-sticky", NofoSticky);
export { NofoSticky };
