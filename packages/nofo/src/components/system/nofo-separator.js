import { NofoElement } from "../../index.js";

class NofoSeparator extends NofoElement {
  static props = {
    size: { type: String, default: "1" },
    orientation: { type: String, default: "horizontal" },
    decorative: { type: Boolean, default: false },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const size = this.props.size || "1";
    const orientation = this.props.orientation || "horizontal";
    const decorative = this.props.decorative;

    const sizes = {
      1: "1px",
      2: "2px",
      3: "3px",
      4: "4px",
    };
    const height = sizes[size] || sizes["1"];

    const styles = {
      backgroundColor: "var(--gray-6)",
      border: "none",
    };

    if (orientation === "horizontal") {
      styles.width = "100%";
      styles.height = height;
    } else {
      styles.width = height;
      styles.height = "100%";
    }

    this.dataset.size = size;
    this.dataset.orientation = orientation;

    this._styles = styles;
    this._roleAttr = decorative ? 'role="presentation"' : "";
  }

  template() {
    const styleString = Object.entries(this._styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
          display: block;
          flex-shrink: 0;
        }
      </style>
      <hr ${this._roleAttr} />
    `;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-separator", NofoSeparator);
export { NofoSeparator };
