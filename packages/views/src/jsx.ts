import { ComponentChild } from "./types";

export declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  type Element = any;
  interface ElementClass {
    render(): ComponentChild;
  }
  interface ElementAttributesProperty {
    props: {};
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Support for standard and custom elements (Web Components).
       * Custom elements are normally kebab-case.
       */
      [elemName: string]: any;
    }
    type Element = any;
    interface ElementClass {
      render(): ComponentChild;
    }
    interface ElementAttributesProperty {
      props: {};
    }
  }
}
