import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIForm extends NofoElement {
  static props = {
    action: "",
    method: "POST",
    enctype: "application/x-www-form-urlencoded",
  };

  onMount() {
    this.sync()
      .attr("action")
      .toDataAttr("action")
      .attr("method")
      .toDataAttr("method")
      .attr("enctype")
      .toDataAttr("enctype");
  }

  template() {
    const { action, method, enctype } = this.state;
    return `
      <nofo-form action="${action}" method="${method}" enctype="${enctype}">
        <slot></slot>
      </nofo-form>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-form {
        display: flex;
        flex-direction: column;
        gap: var(--nofo-ui-spacing-lg);
        width: 100%;
      }
    `;
  }
}

customElements.define("nofo-ui-form", NofoUIForm);

export { NofoUIForm };
