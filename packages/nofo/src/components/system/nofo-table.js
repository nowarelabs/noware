import { NofoElement } from "../../index.js";

class NofoTable extends NofoElement {
  static props = {
    size: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    layout: { type: String, reflect: true },
  };

  getSizeStyles(size) {
    const sizes = {
      1: { fontSize: "0.875rem", padding: "0.5rem" },
      2: { fontSize: "1rem", padding: "0.75rem" },
      3: { fontSize: "1.125rem", padding: "1rem" },
    };
    return sizes[size] || sizes["2"];
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const size = this.size || "2";
    const layout = this.layout || "auto";
    const sizeStyles = this.getSizeStyles(size);

    return `
      :host {
        width: 100%;
        border-collapse: collapse;
        table-layout: ${layout};
        font-size: ${sizeStyles.fontSize};
        display: table;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableHeader extends NofoElement {
  template() {
    return `<thead><slot></slot></thead>`;
  }

  styles() {
    return `
      :host {
        display: table-header-group;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableBody extends NofoElement {
  template() {
    return `<tbody><slot></slot></tbody>`;
  }

  styles() {
    return `
      :host {
        display: table-row-group;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableFooter extends NofoElement {
  template() {
    return `<tfoot><slot></slot></tfoot>`;
  }

  styles() {
    return `
      :host {
        display: table-footer-group;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableRow extends NofoElement {
  template() {
    return `<tr><slot></slot></tr>`;
  }

  styles() {
    return `
      :host {
        display: table-row;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableColumnHeaderCell extends NofoElement {
  template() {
    return `<th><slot></slot></th>`;
  }

  styles() {
    const table = this.closest("nofo-table");
    const size = table ? table.size || "2" : "2";

    const sizeStyles = {
      1: { padding: "0.5rem" },
      2: { padding: "0.75rem" },
      3: { padding: "1rem" },
    };
    const s = sizeStyles[size] || sizeStyles["2"];

    return `
      :host {
        padding: ${s.padding};
        font-weight: 600;
        text-align: left;
        border-bottom: 1px solid var(--gray-6);
        color: var(--gray-11);
        display: table-cell;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableRowHeaderCell extends NofoElement {
  template() {
    return `<th><slot></slot></th>`;
  }

  styles() {
    const table = this.closest("nofo-table");
    const size = table ? table.size || "2" : "2";

    const sizeStyles = {
      1: { padding: "0.5rem" },
      2: { padding: "0.75rem" },
      3: { padding: "1rem" },
    };
    const s = sizeStyles[size] || sizeStyles["2"];

    return `
      :host {
        padding: ${s.padding};
        font-weight: 500;
        text-align: left;
        border-bottom: 1px solid var(--gray-6);
        color: var(--gray-11);
        display: table-cell;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTableCell extends NofoElement {
  template() {
    return `<td><slot></slot></td>`;
  }

  styles() {
    const table = this.closest("nofo-table");
    const size = table ? table.size || "2" : "2";

    const sizeStyles = {
      1: { padding: "0.5rem" },
      2: { padding: "0.75rem" },
      3: { padding: "1rem" },
    };
    const s = sizeStyles[size] || sizeStyles["2"];

    return `
      :host {
        padding: ${s.padding};
        border-bottom: 1px solid var(--gray-6);
        color: var(--gray-12);
        display: table-cell;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-table", NofoTable);
customElements.define("nofo-table-header", NofoTableHeader);
customElements.define("nofo-table-body", NofoTableBody);
customElements.define("nofo-table-footer", NofoTableFooter);
customElements.define("nofo-table-row", NofoTableRow);
customElements.define("nofo-table-column-header-cell", NofoTableColumnHeaderCell);
customElements.define("nofo-table-row-header-cell", NofoTableRowHeaderCell);
customElements.define("nofo-table-cell", NofoTableCell);

export {
  NofoTable,
  NofoTableHeader,
  NofoTableBody,
  NofoTableFooter,
  NofoTableRow,
  NofoTableColumnHeaderCell,
  NofoTableRowHeaderCell,
  NofoTableCell,
};
