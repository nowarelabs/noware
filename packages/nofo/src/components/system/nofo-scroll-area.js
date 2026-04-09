import { NofoElement } from "../../index.js";

class NofoScrollArea extends NofoElement {
  static props = {
    type: { type: String, default: "auto" },
    scrollbars: { type: String, default: "vertical" },
    size: { type: String, default: "2" },
    radius: { type: String, default: "medium" },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const size = this.props.size || "2";
    const type = this.props.type || "auto";

    this.dataset.size = size;
    this.dataset.type = type;
  }

  template() {
    const type = this.props.type || "auto";
    const scrollbars = this.props.scrollbars || "vertical";
    const radius = this.props.radius || "medium";

    const radii = {
      none: "0",
      small: "0.125rem",
      medium: "0.25rem",
      large: "0.5rem",
      full: "9999px",
    };
    const borderRadius = radii[radius] || radii["medium"];

    const overflowX = scrollbars === "horizontal" || scrollbars === "both" ? "auto" : "hidden";
    const overflowY = scrollbars === "vertical" || scrollbars === "both" ? "auto" : "hidden";

    const styles = {
      position: "relative",
      overflowX: overflowX,
      overflowY: overflowY,
      borderRadius: borderRadius,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
          display: block;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoScrollAreaScrollbar extends NofoElement {
  static props = {
    orientation: { type: String, default: "vertical" },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const orientation = this.props.orientation || "vertical";
    this.dataset.orientation = orientation;
  }

  template() {
    const orientation = this.props.orientation || "vertical";

    const styles = {
      position: "absolute",
      ...(orientation === "vertical"
        ? {
            right: "0",
            top: "0",
            bottom: "0",
            width: "0.5rem",
          }
        : {
            bottom: "0",
            left: "0",
            right: "0",
            height: "0.5rem",
          }),
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoScrollAreaThumb extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const scrollbar = this.closest("nofo-scroll-area-scrollbar");
    const orientation = scrollbar ? scrollbar.props?.orientation || "vertical" : "vertical";

    const styles = {
      position: "relative",
      backgroundColor: "var(--gray-8)",
      borderRadius: "9999px",
      ...(orientation === "vertical"
        ? {
            width: "100%",
            minHeight: "1.5rem",
          }
        : {
            height: "100%",
            minWidth: "1.5rem",
          }),
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
          display: block;
        }
      </style>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoScrollAreaCorner extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    return `
      <style>
        :host {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 0.5rem;
          height: 0.5rem;
          background-color: var(--gray-6);
          box-sizing: border-box;
        }
      </style>
    `;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-scroll-area", NofoScrollArea);
customElements.define("nofo-scroll-area-scrollbar", NofoScrollAreaScrollbar);
customElements.define("nofo-scroll-area-thumb", NofoScrollAreaThumb);
customElements.define("nofo-scroll-area-corner", NofoScrollAreaCorner);
export { NofoScrollArea, NofoScrollAreaScrollbar, NofoScrollAreaThumb, NofoScrollAreaCorner };
