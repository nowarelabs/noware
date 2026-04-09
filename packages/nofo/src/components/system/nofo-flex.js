import { NofoElement } from "../../index.js";

class NofoFlex extends NofoElement {
  static props = {
    direction: "row",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
    gap: "",
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

    s.attr("direction").toCSS("flex-direction").toDataAttr("direction");
    s.attr("align")
      .toCSS("align-items", (v) => {
        const map = {
          start: "flex-start",
          end: "flex-end",
          center: "center",
          baseline: "baseline",
          stretch: "stretch",
        };
        return map[v] || v;
      })
      .toDataAttr("align");
    s.attr("justify")
      .toCSS("justify-content", (v) => {
        const map = {
          start: "flex-start",
          end: "flex-end",
          center: "center",
          between: "space-between",
        };
        return map[v] || v;
      })
      .toDataAttr("justify");
    s.attr("wrap").toCSS("flex-wrap");
    s.attr("gap").toCSS("gap", (v) => this.#getSpacing(v));

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
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { box-sizing: border-box; display: flex; }`;
  }
}

customElements.define("nofo-flex", NofoFlex);
export { NofoFlex };
