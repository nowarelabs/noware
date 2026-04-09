import { describe, it, expect } from "vitest";
import { BaseRpcTarget, RpcStub, newMessagePortRpcSession } from "./index";

class Greeter extends BaseRpcTarget {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

describe("Thin RPC Wrapper", () => {
  it("BaseRpcTarget can be extended and used with MessagePort", async () => {
    const channel = new MessageChannel();
    newMessagePortRpcSession(channel.port1, new Greeter());
    const stub: RpcStub<Greeter> = newMessagePortRpcSession<Greeter>(channel.port2);
    const result = await stub.greet("World");
    expect(result).toBe("Hello, World!");
  });
});
