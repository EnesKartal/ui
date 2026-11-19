import { effect, ElementRef, inject, TemplateRef } from "@angular/core"

// Fills an element the author left empty with text from its part's state,
// like a field error with the browser's message. `marker` is the attribute
// that says the text is ours, so hydration keeps updating what the server wrote.
function useText(text: () => string | undefined, marker = "data-text") {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  if (el.nodeType !== 1 || inject(TemplateRef, { optional: true })) {
    return
  }
  effect(() => {
    const next = text() ?? ""
    if (!el.hasAttribute(marker)) {
      if (el.childNodes.length) {
        return
      }
      el.setAttribute(marker, "")
    }
    if (el.textContent !== next) {
      el.textContent = next
    }
  })
}

// Takes attributes the author wrote on a part that belong on an element
// inside it, like a slider thumb's `aria-label`, which names its input.
function moveAttributes(names: readonly string[]) {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  const moved: Record<string, string> = {}
  for (const name of names) {
    const value = el.getAttribute(name)
    if (value !== null) {
      moved[name] = value
      el.removeAttribute(name)
    }
  }
  return moved
}

export { moveAttributes, useText }
