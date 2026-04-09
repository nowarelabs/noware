import { NofoElement } from "../../index.js";

class NofoText extends NofoElement {
  static props = {
    as: "p",
    size: "3",
    weight: "regular",
    align: "left",
    trim: "normal",
    color: "",
    "high-contrast": false,
  };

  onMount() {
    const s = this.sync();

    s.attr("size")
      .toCSS("font-size", (v) => `var(--font-size-${v})`)
      .toCSS("line-height", (v) => `var(--line-height-${v})`)
      .toDataAttr("size");

    s.attr("weight")
      .toCSS("font-weight", (v) => {
        const map = { light: "300", regular: "400", medium: "500", bold: "700" };
        return map[v] || v;
      })
      .toDataAttr("weight");

    s.attr("align").toCSS("text-align");

    s.attr("color").toCSS("color", (v) => {
      const map = { gray: "var(--gray-11)", accent: "var(--accent-11)" };
      return map[v] || v;
    });

    s.attr("high-contrast")
      .toCSS("color", (v) => (v ? "var(--gray-12)" : null))
      .toDataAttr("high-contrast");

    s.attr("trim")
      .toCSS("margin-top", (v) => (v === "start" || v === "both" ? "0" : null))
      .toCSS("margin-bottom", (v) => (v === "end" || v === "both" ? "0" : null));
  }

  template() {
    const Tag = this.as;
    return `<${Tag}><slot></slot></${Tag}>`;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
        margin: 0;
      }
      p, span, div, label, h1, h2, h3, h4, h5, h6 {
        all: unset;
        display: block;
        width: 100%;
      }
      span { display: inline-block; }
    `;
  }
}

customElements.define("nofo-text", NofoText);
export { NofoText };
