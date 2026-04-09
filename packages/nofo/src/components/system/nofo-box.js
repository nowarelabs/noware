import { NofoElement } from "../../index.js";

class NofoBox extends NofoElement {
  static props = {
    p: "",
    px: "",
    py: "",
    pt: "",
    pr: "",
    pb: "",
    pl: "",
    m: "",
    mx: "",
    my: "",
    mt: "",
    mr: "",
    mb: "",
    ml: "",
    width: "",
    "min-width": "",
    "max-width": "",
    height: "",
    "min-height": "",
    "max-height": "",
    position: "",
    inset: "",
    top: "",
    right: "",
    bottom: "",
    left: "",
    "flex-basis": "",
    "flex-shrink": "",
    "flex-grow": "",
    "grid-area": "",
    "grid-column": "",
    "grid-column-start": "",
    "grid-column-end": "",
    "grid-row": "",
    "grid-row-start": "",
    "grid-row-end": "",
    display: "",
  };

  #getSpacing(val) {
    if (!val) return null;
    const map = {
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
    return map[val] || val;
  }

  onMount() {
    const s = this.sync();

    s.attr("p").toCSS("padding", (v) => this.#getSpacing(v));
    s.attr("px").toCSS("padding-left", (v) => this.#getSpacing(v));
    s.attr("px").toCSS("padding-right", (v) => this.#getSpacing(v));
    s.attr("py").toCSS("padding-top", (v) => this.#getSpacing(v));
    s.attr("py").toCSS("padding-bottom", (v) => this.#getSpacing(v));
    s.attr("pt").toCSS("padding-top", (v) => this.#getSpacing(v));
    s.attr("pr").toCSS("padding-right", (v) => this.#getSpacing(v));
    s.attr("pb").toCSS("padding-bottom", (v) => this.#getSpacing(v));
    s.attr("pl").toCSS("padding-left", (v) => this.#getSpacing(v));

    s.attr("m").toCSS("margin", (v) => this.#getSpacing(v));
    s.attr("mx").toCSS("margin-left", (v) => this.#getSpacing(v));
    s.attr("mx").toCSS("margin-right", (v) => this.#getSpacing(v));
    s.attr("my").toCSS("margin-top", (v) => this.#getSpacing(v));
    s.attr("my").toCSS("margin-bottom", (v) => this.#getSpacing(v));
    s.attr("mt").toCSS("margin-top", (v) => this.#getSpacing(v));
    s.attr("mr").toCSS("margin-right", (v) => this.#getSpacing(v));
    s.attr("mb").toCSS("margin-bottom", (v) => this.#getSpacing(v));
    s.attr("ml").toCSS("margin-left", (v) => this.#getSpacing(v));

    s.attr("width").toCSS("width");
    s.attr("min-width").toCSS("min-width");
    s.attr("max-width").toCSS("max-width");
    s.attr("height").toCSS("height");
    s.attr("min-height").toCSS("min-height");
    s.attr("max-height").toCSS("max-height");

    s.attr("position").toCSS("position").toDataAttr("position");
    s.attr("inset").toCSS("inset");
    s.attr("top").toCSS("top");
    s.attr("right").toCSS("right");
    s.attr("bottom").toCSS("bottom");
    s.attr("left").toCSS("left");

    s.attr("flex-basis").toCSS("flex-basis");
    s.attr("flex-shrink").toCSS("flex-shrink");
    s.attr("flex-grow").toCSS("flex-grow");
    s.attr("grid-area").toCSS("grid-area");
    s.attr("grid-column").toCSS("grid-column");
    s.attr("grid-row").toCSS("grid-row");
    s.attr("display").toCSS("display").toDataAttr("display");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { box-sizing: border-box; display: block; }`;
  }
}

customElements.define("nofo-box", NofoBox);
export { NofoBox };
