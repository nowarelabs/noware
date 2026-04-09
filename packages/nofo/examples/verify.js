import { NofoElement } from "../src/index.js";

class TestElement extends NofoElement {
  static props = {
    title: "Hello",
  };

  onMount() {
    console.log("Mounted!");
    this.state.count = 0;

    // Test effect
    this.effect(() => {
      console.log("Count changed:", this.state.count);
    });

    // Test sync
    this.sync().value(this.state.count).toCSSVar("--test-count");
  }

  template() {
    return `<h1>${this.title}</h1><button on-click="inc">Count: ${this.state.count}</button>`;
  }

  inc() {
    this.state.count++;
  }
}

customElements.define("test-element", TestElement);
console.log("TestElement defined");
