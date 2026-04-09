import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIAvatar extends NofoElement {
  static props = {
    size: { type: String, default: "md" },
    variant: { type: String, default: "solid" },
  };

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: inline-block;
        }
        
        nofo-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 2px solid var(--nofo-ui-border);
          background-color: var(--nofo-ui-background-secondary);
          overflow: hidden;
        }
      </style>
      <nofo-avatar>
        <slot></slot>
      </nofo-avatar>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._avatar = this.shadowRoot.querySelector("nofo-avatar");
    this.sync();
  }

  sync() {
    if (this._avatar) {
      const size = this.size || "md";
      const sizeMap = {
        sm: "1",
        md: "2",
        lg: "3",
        xl: "4",
      };
      this._avatar.setAttribute("size", sizeMap[size] || "2");

      const variant = this.variant || "solid";
      this._avatar.setAttribute("variant", variant);
    }
  }
}

class NofoUIAvatarImage extends NofoElement {
  static props = {
    src: { type: String, default: "" },
    alt: { type: String, default: "" },
  };

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
        
        nofo-avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      </style>
      <nofo-avatar-image ${this.src ? `src="${this.src}"` : ""} ${this.alt ? `alt="${this.alt}"` : ""}></nofo-avatar-image>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUIAvatarFallback extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background-color: var(--nofo-ui-accent-primary);
          color: var(--nofo-ui-background);
          font-weight: 600;
          font-size: var(--nofo-ui-font-size-sm);
        }
        
        nofo-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
      </style>
      <nofo-avatar-fallback>
        <slot></slot>
      </nofo-avatar-fallback>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-avatar", NofoUIAvatar);
customElements.define("nofo-ui-avatar-image", NofoUIAvatarImage);
customElements.define("nofo-ui-avatar-fallback", NofoUIAvatarFallback);
