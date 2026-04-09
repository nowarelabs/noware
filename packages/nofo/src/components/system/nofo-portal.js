import { NofoElement } from "../../index.js";

class NofoPortal extends NofoElement {
  onMount() {
    this._portalRoot = document.createElement("div");
    this._portalRoot.setAttribute("data-portal", "true");
    document.body.appendChild(this._portalRoot);
    this.moveChildren();

    this._observer = new MutationObserver(() => this.moveChildren());
    this._observer.observe(this, { childList: true });
  }

  onUnmount() {
    if (this._observer) this._observer.disconnect();
    if (this._portalRoot && this._portalRoot.parentNode) {
      this._portalRoot.parentNode.removeChild(this._portalRoot);
    }
  }

  moveChildren() {
    if (!this._portalRoot) return;
    while (this.firstChild) {
      this._portalRoot.appendChild(this.firstChild);
    }
  }

  template() {
    return "";
  }

  styles() {
    return `:host { display: none; }`;
  }
}

customElements.define("nofo-portal", NofoPortal);
export { NofoPortal };
