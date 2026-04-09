import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIDatePicker extends NofoElement {
  static props = {
    value: null,
    open: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("open").toDataAttr("open");
  }

  template() {
    return `
      <nofo-ui-popover>
        <slot></slot>
      </nofo-ui-popover>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
    `;
  }
}

class NofoUIDatePickerTrigger extends NofoElement {
  template() {
    return `
      <nofo-ui-popover-trigger>
        <slot></slot>
      </nofo-ui-popover-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIDatePickerContent extends NofoElement {
  template() {
    return `
      <nofo-ui-popover-content>
        <slot></slot>
      </nofo-ui-popover-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

customElements.define("nofo-ui-date-picker", NofoUIDatePicker);
customElements.define("nofo-ui-date-picker-trigger", NofoUIDatePickerTrigger);
customElements.define("nofo-ui-date-picker-content", NofoUIDatePickerContent);

export { NofoUIDatePicker, NofoUIDatePickerTrigger, NofoUIDatePickerContent };
