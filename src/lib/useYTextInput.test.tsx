import { describe, it, expect } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as Y from "yjs";
import { useYTextInput } from "./useYTextInput";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = {
  input: HTMLInputElement;
  textarea: HTMLTextAreaElement;
  setFallback: (s: string) => void;
  unmount: () => void;
};

function mountInput(yText: Y.Text | null, initial: string): Harness & { fallback: () => string } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let fallback = initial;
  let setFallbackOuter: (s: string) => void = () => {};
  let inputEl: HTMLInputElement | null = null;
  let textareaEl: HTMLTextAreaElement | null = null;

  function TestComp() {
    const [val, setVal] = React.useState(initial);
    setFallbackOuter = (s: string) => {
      fallback = s;
      setVal(s);
    };
    const binding = useYTextInput(yText, val, (s) => {
      fallback = s;
      setVal(s);
    });
    const taBinding = useYTextInput(yText, val, (s) => {
      fallback = s;
      setVal(s);
    });
    return (
      <>
        <input ref={binding.ref} onChange={binding.onChange} />
        <textarea ref={taBinding.ref} onChange={taBinding.onChange} />
      </>
    );
  }

  act(() => {
    root.render(<TestComp />);
  });
  inputEl = container.querySelector("input")!;
  textareaEl = container.querySelector("textarea")!;

  return {
    input: inputEl,
    textarea: textareaEl,
    setFallback: setFallbackOuter,
    fallback: () => fallback,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function fireChange(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React tracks input value via an internal setter to dedupe events; assigning
  // .value directly bypasses the tracker. Use the prototype setter so React's
  // synthetic onChange actually fires.
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(el, value);
  act(() => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("useYTextInput — solo mode (no Y.Text)", () => {
  it("initializes the element with the fallback value", () => {
    const h = mountInput(null, "hello");
    expect(h.input.value).toBe("hello");
    expect(h.textarea.value).toBe("hello");
    h.unmount();
  });

  it("calls setFallback on user input", () => {
    const h = mountInput(null, "");
    fireChange(h.input, "abc");
    expect(h.fallback()).toBe("abc");
    h.unmount();
  });

  it("syncs the element when fallback changes externally", () => {
    const h = mountInput(null, "one");
    act(() => h.setFallback("two"));
    expect(h.input.value).toBe("two");
    h.unmount();
  });
});

describe("useYTextInput — collab mode (with Y.Text)", () => {
  function makeYText(initial: string): { doc: Y.Doc; yText: Y.Text } {
    const doc = new Y.Doc();
    const yText = doc.getText("t");
    yText.insert(0, initial);
    return { doc, yText };
  }

  it("initializes the element from the Y.Text contents", () => {
    const { yText } = makeYText("hello");
    const h = mountInput(yText, "");
    expect(h.input.value).toBe("hello");
    h.unmount();
  });

  it("translates a local insert into Y.Text.insert", () => {
    const { yText } = makeYText("ab");
    const h = mountInput(yText, "ab");
    fireChange(h.input, "aXb");
    expect(yText.toString()).toBe("aXb");
    h.unmount();
  });

  it("translates a local delete into Y.Text.delete", () => {
    const { yText } = makeYText("abc");
    const h = mountInput(yText, "abc");
    fireChange(h.input, "ac");
    expect(yText.toString()).toBe("ac");
    h.unmount();
  });

  it("applies a remote insert and shifts the caret past the insertion point", () => {
    const { yText } = makeYText("hello");
    const h = mountInput(yText, "hello");
    h.input.focus();
    h.input.setSelectionRange(5, 5);
    // Remote insert at position 0
    act(() => {
      yText.insert(0, "XY");
    });
    expect(h.input.value).toBe("XYhello");
    expect(h.input.selectionStart).toBe(7);
    expect(h.input.selectionEnd).toBe(7);
    h.unmount();
  });

  it("keeps the caret put when a remote insert lands after it", () => {
    const { yText } = makeYText("hello");
    const h = mountInput(yText, "hello");
    h.input.focus();
    h.input.setSelectionRange(2, 2);
    act(() => {
      yText.insert(5, "!!");
    });
    expect(h.input.value).toBe("hello!!");
    expect(h.input.selectionStart).toBe(2);
    h.unmount();
  });

  it("shifts the caret back on a remote delete that occurred before it", () => {
    const { yText } = makeYText("abcdef");
    const h = mountInput(yText, "abcdef");
    h.input.focus();
    h.input.setSelectionRange(5, 5);
    act(() => {
      yText.delete(0, 2); // "cdef"
    });
    expect(h.input.value).toBe("cdef");
    expect(h.input.selectionStart).toBe(3);
    h.unmount();
  });

  it("ignores echoed Y.Text events when value already matches", () => {
    const { yText } = makeYText("hi");
    const h = mountInput(yText, "hi");
    // Manually set element value and fire a no-op event by inserting empty.
    // The observer fires for every change; here we ensure equal values don't
    // throw and don't move the caret.
    h.input.focus();
    h.input.setSelectionRange(2, 2);
    act(() => {
      yText.insert(2, "");
    });
    expect(h.input.value).toBe("hi");
    expect(h.input.selectionStart).toBe(2);
    h.unmount();
  });

  it("unsubscribes from the Y.Text on unmount", () => {
    const { yText } = makeYText("x");
    const h = mountInput(yText, "x");
    h.unmount();
    // After unmount, mutating the Y.Text must not throw.
    expect(() => yText.insert(0, "!")).not.toThrow();
    expect(yText.toString()).toBe("!x");
  });

  it("no-ops onChange when the input value matches the Y.Text", () => {
    const { yText } = makeYText("same");
    const h = mountInput(yText, "same");
    // Fire change with the same value — should not throw, Y.Text unchanged.
    fireChange(h.input, "same");
    expect(yText.toString()).toBe("same");
    h.unmount();
  });

});
