import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIPagination extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    total: 0,
    perPage: 10,
  };

  onMount() {
    this.sync()
      .attr("value")
      .toDataAttr("value")
      .attr("defaultValue")
      .toDataAttr("defaultValue")
      .attr("total")
      .toDataAttr("total")
      .attr("perPage")
      .toDataAttr("perPage");
  }

  template() {
    return `
      <nofo-pagination
        value="${this.state.value || ""}"
        defaultValue="${this.state.defaultValue || ""}"
        total="${this.state.total}"
        perPage="${this.state.perPage}"
      >
        <slot></slot>
      </nofo-pagination>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: flex; align-items: center; gap: var(--nofo-ui-spacing-sm); }
      nofo-pagination { display: flex; align-items: center; gap: var(--nofo-ui-spacing-sm); }
    `;
  }
}

class NofoUIPaginationPrevious extends NofoElement {
  template() {
    return `
      <nofo-pagination-previous>
        <slot></slot>
      </nofo-pagination-previous>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-pagination-previous {
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        background-color: var(--nofo-ui-background-secondary);
        color: var(--nofo-ui-foreground);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      nofo-pagination-previous:hover {
        background-color: var(--nofo-ui-hover);
        border-color: var(--nofo-ui-accent-primary);
      }
      nofo-pagination-previous[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoUIPaginationNext extends NofoElement {
  template() {
    return `
      <nofo-pagination-next>
        <slot></slot>
      </nofo-pagination-next>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-pagination-next {
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        background-color: var(--nofo-ui-background-secondary);
        color: var(--nofo-ui-foreground);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      nofo-pagination-next:hover {
        background-color: var(--nofo-ui-hover);
        border-color: var(--nofo-ui-accent-primary);
      }
      nofo-pagination-next[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoUIPaginationPages extends NofoElement {
  template() {
    return `
      <nofo-pagination-pages>
        <slot></slot>
      </nofo-pagination-pages>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-pagination-pages { display: flex; align-items: center; gap: var(--nofo-ui-spacing-xs); }
    `;
  }
}

customElements.define("nofo-ui-pagination", NofoUIPagination);
customElements.define("nofo-ui-pagination-previous", NofoUIPaginationPrevious);
customElements.define("nofo-ui-pagination-next", NofoUIPaginationNext);
customElements.define("nofo-ui-pagination-pages", NofoUIPaginationPages);

export { NofoUIPagination, NofoUIPaginationPrevious, NofoUIPaginationNext, NofoUIPaginationPages };
