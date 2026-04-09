import { NofoElement } from "../../index.js";

class NofoStack extends NofoElement {
  static props = {
    direction: "vertical",
    gap: "md",
    align: "stretch",
  };

  #getGapValue(gap) {
    const map = {
      sm: "var(--space-2)",
      md: "var(--space-3)",
      lg: "var(--space-4)",
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
    return map[gap] || gap;
  }

  onMount() {
    const s = this.sync();

    s.attr("direction")
      .toCSS("flex-direction", (v) => (v === "horizontal" ? "row" : "column"))
      .toDataAttr("direction");

    s.attr("gap")
      .toCSS("gap", (v) => this.#getGapValue(v))
      .toDataAttr("gap");

    s.attr("align")
      .toCSS("align-items", (v) => {
        const map = { start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" };
        return map[v] || v;
      })
      .toDataAttr("align");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { box-sizing: border-box; display: flex; }`;
  }
}

customElements.define("nofo-stack", NofoStack);
export { NofoStack };
