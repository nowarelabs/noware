import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIEmpty extends NofoElement {
  template() {
    return `
      <nofo-empty-state>
        <slot></slot>
      </nofo-empty-state>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--nofo-ui-spacing-xl);
        text-align: center;
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

class NofoUIEmptyIcon extends NofoElement {
  template() {
    return `<div><slot></slot></div>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; margin-bottom: var(--nofo-ui-spacing-md); font-size: 3rem; opacity: 0.5; }
    `;
  }
}

class NofoUIEmptyTitle extends NofoElement {
  template() {
    return `
      <nofo-heading size="4">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; margin-bottom: var(--nofo-ui-spacing-sm); }
      nofo-heading { font-size: var(--nofo-ui-font-size-lg); font-weight: 600; color: var(--nofo-ui-foreground); }
    `;
  }
}

class NofoUIEmptyDescription extends NofoElement {
  template() {
    return `
      <nofo-text size="2">
        <slot></slot>
      </nofo-text>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; margin-bottom: var(--nofo-ui-spacing-lg); }
      nofo-text { font-size: var(--nofo-ui-font-size-sm); color: var(--nofo-ui-foreground-secondary); }
    `;
  }
}

class NofoUIEmptyAction extends NofoElement {
  template() {
    return `<div><slot></slot></div>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
    `;
  }
}

customElements.define("nofo-ui-empty", NofoUIEmpty);
customElements.define("nofo-ui-empty-icon", NofoUIEmptyIcon);
customElements.define("nofo-ui-empty-title", NofoUIEmptyTitle);
customElements.define("nofo-ui-empty-description", NofoUIEmptyDescription);
customElements.define("nofo-ui-empty-action", NofoUIEmptyAction);

export {
  NofoUIEmpty,
  NofoUIEmptyIcon,
  NofoUIEmptyTitle,
  NofoUIEmptyDescription,
  NofoUIEmptyAction,
};
