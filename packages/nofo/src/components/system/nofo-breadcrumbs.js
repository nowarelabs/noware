import { NofoElement } from "../../index.js";

class NofoBreadcrumbs extends NofoElement {
  template() {
    return `
      <nav aria-label="Breadcrumb">
        <ol class="root">
          <slot></slot>
        </ol>
      </nav>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        list-style: none;
        margin: 0;
        padding: 0;
        flex-wrap: wrap;
      }
    `;
  }
}

class NofoBreadcrumbsItem extends NofoElement {
  template() {
    return `
      <li class="item">
        <slot></slot>
      </li>
    `;
  }

  styles() {
    return `
      :host { display: flex; align-items: center; box-sizing: border-box; }
      .item { display: flex; align-items: center; }
    `;
  }
}

class NofoBreadcrumbsSeparator extends NofoElement {
  template() {
    return `
      <li role="presentation" aria-hidden="true" class="separator">
        <nofo-icon name="chevron-right" size="sm"></nofo-icon>
      </li>
    `;
  }

  styles() {
    return `
      :host { display: flex; align-items: center; box-sizing: border-box; }
      .separator {
        display: flex;
        align-items: center;
        color: var(--gray-8);
      }
    `;
  }
}

customElements.define("nofo-breadcrumbs", NofoBreadcrumbs);
customElements.define("nofo-breadcrumbs-item", NofoBreadcrumbsItem);
customElements.define("nofo-breadcrumbs-separator", NofoBreadcrumbsSeparator);

export { NofoBreadcrumbs, NofoBreadcrumbsItem, NofoBreadcrumbsSeparator };
