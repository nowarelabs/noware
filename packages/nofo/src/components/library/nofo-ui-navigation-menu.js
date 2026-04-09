import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUINavigationMenu extends NofoElement {
  static props = {
    orientation: "horizontal",
  };

  onMount() {
    this.sync().attr("orientation").toDataAttr("orientation");
  }

  template() {
    return `
      <nofo-navigation orientation="${this.state.orientation}">
        <slot></slot>
      </nofo-navigation>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-navigation { width: 100%; }
    `;
  }
}

class NofoUINavigationMenuList extends NofoElement {
  template() {
    return `
      <nofo-nav-group>
        <slot></slot>
      </nofo-nav-group>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUINavigationMenuItem extends NofoElement {
  static props = {
    value: "",
    href: "#",
    active: false,
  };

  onMount() {
    this.sync().attr("active").toDataAttr("active");
  }

  template() {
    const { href, active } = this.state;
    return `
      <nofo-nav-item href="${href}" ?active="${active}">
        <slot></slot>
      </nofo-nav-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-nav-item {
        --accent-9: var(--nofo-ui-accent-primary);
        --accent-3: var(--nofo-ui-hover);
        --gray-11: var(--nofo-ui-foreground);
      }
    `;
  }
}

class NofoUINavigationMenuTrigger extends NofoElement {
  template() {
    return `
      <nofo-nav-sub-trigger>
        <slot></slot>
      </nofo-nav-sub-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
    `;
  }
}

class NofoUINavigationMenuContent extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open");
  }

  template() {
    return `
      <nofo-nav-sub-content ?open="${this.state.open}">
        <slot></slot>
      </nofo-nav-sub-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-nav-sub-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
      }
    `;
  }
}

class NofoUINavigationMenuLink extends NofoElement {
  static props = {
    href: "#",
  };

  template() {
    return `
      <nofo-link href="${this.state.href}">
        <slot></slot>
      </nofo-link>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
    `;
  }
}

customElements.define("nofo-ui-navigation-menu", NofoUINavigationMenu);
customElements.define("nofo-ui-navigation-menu-list", NofoUINavigationMenuList);
customElements.define("nofo-ui-navigation-menu-item", NofoUINavigationMenuItem);
customElements.define("nofo-ui-navigation-menu-trigger", NofoUINavigationMenuTrigger);
customElements.define("nofo-ui-navigation-menu-content", NofoUINavigationMenuContent);
customElements.define("nofo-ui-navigation-menu-link", NofoUINavigationMenuLink);

export {
  NofoUINavigationMenu,
  NofoUINavigationMenuList,
  NofoUINavigationMenuItem,
  NofoUINavigationMenuTrigger,
  NofoUINavigationMenuContent,
  NofoUINavigationMenuLink,
};
