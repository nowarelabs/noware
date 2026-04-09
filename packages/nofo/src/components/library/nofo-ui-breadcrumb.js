import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIBreadcrumb extends NofoElement {
  template() {
    return `
      <nofo-breadcrumbs>
        <slot></slot>
      </nofo-breadcrumbs>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
    `;
  }
}

class NofoUIBreadcrumbItem extends NofoElement {
  static props = {
    current: false,
  };

  onMount() {
    this.sync().attr("current").toDataAttr("current");
  }

  template() {
    return `
      <nofo-breadcrumbs-item>
        <slot></slot>
      </nofo-breadcrumbs-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-flex; }
      nofo-breadcrumbs-item {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
      :host([data-current]) nofo-breadcrumbs-item {
        color: var(--nofo-ui-foreground);
        font-weight: 500;
      }
    `;
  }
}

class NofoUIBreadcrumbSeparator extends NofoElement {
  template() {
    return `
      <nofo-breadcrumbs-separator></nofo-breadcrumbs-separator>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-flex; }
      nofo-breadcrumbs-separator {
        color: var(--nofo-ui-foreground-tertiary);
      }
    `;
  }
}

customElements.define("nofo-ui-breadcrumb", NofoUIBreadcrumb);
customElements.define("nofo-ui-breadcrumb-item", NofoUIBreadcrumbItem);
customElements.define("nofo-ui-breadcrumb-separator", NofoUIBreadcrumbSeparator);

export { NofoUIBreadcrumb, NofoUIBreadcrumbItem, NofoUIBreadcrumbSeparator };
