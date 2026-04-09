import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUITable extends NofoElement {
  template() {
    return `
      <nofo-table>
        <slot></slot>
      </nofo-table>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-table {
        display: table;
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        overflow: hidden;
      }
    `;
  }
}

class NofoUITableHeader extends NofoElement {
  template() {
    return `
      <nofo-table-header>
        <slot></slot>
      </nofo-table-header>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-table-header {
        display: table-header-group;
        background-color: var(--nofo-ui-background-secondary);
      }
    `;
  }
}

class NofoUITableBody extends NofoElement {
  template() {
    return `
      <nofo-table-body>
        <slot></slot>
      </nofo-table-body>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-table-body {
        display: table-row-group;
      }
    `;
  }
}

class NofoUITableRow extends NofoElement {
  template() {
    return `
      <nofo-table-row>
        <slot></slot>
      </nofo-table-row>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-table-row {
        display: table-row;
        border-bottom: 1px solid var(--nofo-ui-border);
        transition: background-color 0.15s ease;
      }
      nofo-table-row:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-table-row:last-child {
        border-bottom: none;
      }
    `;
  }
}

class NofoUITableHead extends NofoElement {
  template() {
    return `
      <nofo-table-head>
        <slot></slot>
      </nofo-table-head>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-table-head {
        display: table-cell;
        padding: var(--nofo-ui-spacing-md);
        font-weight: 600;
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground);
        text-align: left;
        border-right: 1px solid var(--nofo-ui-border);
      }
      nofo-table-head:last-child {
        border-right: none;
      }
    `;
  }
}

class NofoUITableCell extends NofoElement {
  template() {
    return `
      <nofo-table-cell>
        <slot></slot>
      </nofo-table-cell>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-table-cell {
        display: table-cell;
        padding: var(--nofo-ui-spacing-md);
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
        border-right: 1px solid var(--nofo-ui-border);
      }
      nofo-table-cell:last-child {
        border-right: none;
      }
    `;
  }
}

customElements.define("nofo-ui-table", NofoUITable);
customElements.define("nofo-ui-table-header", NofoUITableHeader);
customElements.define("nofo-ui-table-body", NofoUITableBody);
customElements.define("nofo-ui-table-row", NofoUITableRow);
customElements.define("nofo-ui-table-head", NofoUITableHead);
customElements.define("nofo-ui-table-cell", NofoUITableCell);

export {
  NofoUITable,
  NofoUITableHeader,
  NofoUITableBody,
  NofoUITableRow,
  NofoUITableHead,
  NofoUITableCell,
};
