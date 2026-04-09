import { NofoElement } from "../../index.js";

class NofoDataList extends NofoElement {
  static props = {
    size: { type: String, default: "2" },
    orientation: { type: String, default: "vertical" },
    trim: { type: String, default: "normal" },
  };

  getSizeStyles(size) {
    const sizes = {
      1: { gap: "0.5rem", fontSize: "0.875rem" },
      2: { gap: "0.75rem", fontSize: "1rem" },
      3: { gap: "1rem", fontSize: "1.125rem" },
    };
    return sizes[size] || sizes["2"];
  }

  getOrientationStyles(orientation) {
    if (orientation === "horizontal") {
      return {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
      };
    }
    return {
      display: "flex",
      flexDirection: "column",
    };
  }

  getTrimStyles(trim) {
    const trims = {
      normal: {},
      start: { marginTop: 0 },
      end: { marginBottom: 0 },
      both: { marginTop: 0, marginBottom: 0 },
    };
    return trims[trim] || trims["normal"];
  }

  onMount() {
    const sizeStyles = this.getSizeStyles(this.props.size);
    const orientationStyles = this.getOrientationStyles(this.props.orientation);
    const trimStyles = this.getTrimStyles(this.props.trim);

    const styles = {
      ...orientationStyles,
      ...trimStyles,
      gap: sizeStyles.gap,
      fontSize: sizeStyles.fontSize,
      boxSizing: "border-box",
    };

    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: ${this.props.orientation === "horizontal" ? "row" : "column"};
        flex-wrap: ${this.props.orientation === "horizontal" ? "wrap" : "nowrap"};
        gap: ${this.getSizeStyles(this.props.size).gap};
        font-size: ${this.getSizeStyles(this.props.size).fontSize};
        margin-top: ${this.props.trim === "start" || this.props.trim === "both" ? "0" : ""};
        margin-bottom: ${this.props.trim === "end" || this.props.trim === "both" ? "0" : ""};
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDataListItem extends NofoElement {
  static props = {
    align: { type: String, default: "start" },
  };

  getAlignStyles(align) {
    const aligns = {
      start: "flex-start",
      center: "center",
      baseline: "baseline",
    };
    return aligns[align] || "flex-start";
  }

  onMount() {
    const styles = {
      display: "flex",
      alignItems: this.getAlignStyles(this.props.align),
      gap: "0.5rem",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: ${this.getAlignStyles(this.props.align)};
        gap: 0.5rem;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDataListLabel extends NofoElement {
  static props = {
    minWidth: { type: String, default: "auto" },
  };

  onMount() {
    const styles = {
      minWidth: this.props.minWidth,
      fontWeight: "500",
      color: "var(--gray-11)",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        min-width: ${this.props.minWidth};
        font-weight: 500;
        color: var(--gray-11);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDataListValue extends NofoElement {
  onMount() {
    const styles = {
      flex: 1,
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        flex: 1;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-data-list", NofoDataList);
customElements.define("nofo-data-list-item", NofoDataListItem);
customElements.define("nofo-data-list-label", NofoDataListLabel);
customElements.define("nofo-data-list-value", NofoDataListValue);

export { NofoDataList, NofoDataListItem, NofoDataListLabel, NofoDataListValue };
