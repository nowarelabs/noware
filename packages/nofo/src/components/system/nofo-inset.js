import { NofoElement } from "../../index.js";

class NofoInset extends NofoElement {
  static props = {
    clip: { type: String, default: "" },
    side: { type: String, default: "all" },
    p: { type: String, default: "" },
    px: { type: String, default: "" },
    py: { type: String, default: "" },
    pt: { type: String, default: "" },
    pr: { type: String, default: "" },
    pb: { type: String, default: "" },
    pl: { type: String, default: "" },
  };

  onMount() {}

  getClipStyles(clip) {
    const clips = {
      "padding-box": "padding-box",
      "border-box": "border-box",
    };

    return clips[clip] || "padding-box";
  }

  getSideStyles(side) {
    const sides = {
      all: { top: 0, right: 0, bottom: 0, left: 0 },
      top: { top: 0 },
      right: { right: 0 },
      bottom: { bottom: 0 },
      left: { left: 0 },
      x: { left: 0, right: 0 },
      y: { top: 0, bottom: 0 },
    };

    return sides[side] || sides["all"];
  }

  getPaddingValue(value) {
    if (value === "current") {
      return "1rem";
    }

    if (!value) return null;

    const spacingScale = {
      0: "0",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      8: "var(--space-8)",
      9: "var(--space-9)",
    };

    return spacingScale[value] || value;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const styles = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
    };

    const clip = this.props.clip;
    if (clip) {
      styles["clip-path"] = `inset(${this.getClipStyles(clip)})`;
    }

    const side = this.props.side || "all";
    const sideStyles = this.getSideStyles(side);

    const p = this.getPaddingValue(this.props.p);
    const px = this.getPaddingValue(this.props.px);
    const py = this.getPaddingValue(this.props.py);
    const pt = this.getPaddingValue(this.props.pt);
    const pr = this.getPaddingValue(this.props.pr);
    const pb = this.getPaddingValue(this.props.pb);
    const pl = this.getPaddingValue(this.props.pl);

    if (p) {
      if (sideStyles.top !== undefined) styles["margin-top"] = `-${p}`;
      if (sideStyles.right !== undefined) styles["margin-right"] = `-${p}`;
      if (sideStyles.bottom !== undefined) styles["margin-bottom"] = `-${p}`;
      if (sideStyles.left !== undefined) styles["margin-left"] = `-${p}`;
    }

    if (px) {
      if (sideStyles.left !== undefined) styles["margin-left"] = `-${px}`;
      if (sideStyles.right !== undefined) styles["margin-right"] = `-${px}`;
    }

    if (py) {
      if (sideStyles.top !== undefined) styles["margin-top"] = `-${py}`;
      if (sideStyles.bottom !== undefined) styles["margin-bottom"] = `-${py}`;
    }

    if (pt && sideStyles.top !== undefined) styles["margin-top"] = `-${pt}`;
    if (pr && sideStyles.right !== undefined) styles["margin-right"] = `-${pr}`;
    if (pb && sideStyles.bottom !== undefined) styles["margin-bottom"] = `-${pb}`;
    if (pl && sideStyles.left !== undefined) styles["margin-left"] = `-${pl}`;

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      :host {
        ${styleString}
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-inset", NofoInset);
export { NofoInset };
