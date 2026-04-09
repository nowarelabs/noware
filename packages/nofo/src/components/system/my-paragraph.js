import { NofoElement } from "../../index.js";

class MyParagraph extends NofoElement {
  static props = {
    color: "",
    size: "",
    "data-provider": "",
  };

  onMount() {
    const s = this.sync();
    s.attr("color").toCSSVar("--background-color");
    s.attr("size").toCSSVar("--font-size");

    console.log("Custom element added to page.");
    this.connectToDataProvider();
  }

  onUnmount() {
    console.log("Custom element removed from page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} has changed.`);
    if (name === "data-provider" && this.isConnected) {
      this.connectToDataProvider();
    }
  }

  connectToDataProvider() {
    const storeName = this.getAttribute("data-provider");

    if (!storeName) return;

    const store = window.__dataStores?.[storeName];

    if (store) {
      const dataStore = store.select("data");
      const loadingStore = store.select("loading");
      const errorStore = store.select("error");

      if (dataStore && dataStore.select) {
        const titleStore = dataStore.select("title");
        const metaStore = dataStore.select("meta");

        if (titleStore && metaStore) {
          this.effect(() => {
            this._title = titleStore.get();
            this.updateContent();
          });

          const tagsStore = metaStore.select("tags");
          if (tagsStore) {
            this.effect(() => {
              this._tags = tagsStore.get() || [];
              this.updateContent();
            });
          }
        }
      }

      this.effect(() => {
        this._loading = loadingStore.get();
        this.updateStates();
      });

      this.effect(() => {
        this._error = errorStore.get();
        this.updateStates();
        this.updateError();
      });
    } else {
      console.warn(`MyParagraph: Store "${storeName}" not found.`);
    }
  }

  updateContent() {
    const title = this._title || "";
    const tags = this._tags || [];
    const text = title ? `${title} ${tags.join(", ")}` : "";
    this.dataset.storeContent = text;
  }

  updateStates() {
    this.dataset.loading = this._loading || false;
    this.dataset.error = !!this._error;
  }

  updateError() {
    if (this._error) {
      this.style.setProperty("--error-message", `"${this._error}"`);
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        --background-color: inherit;
        --font-size: inherit;
      }
    `;
  }
}

customElements.define("my-paragraph", MyParagraph);
export { MyParagraph };
