import {
  afterRenderEffect,
  APP_ID,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  type EmbeddedViewRef,
  type Signal,
} from "@angular/core"
import type {
  OptionsOf,
  Primitive,
  PropsOf,
  SlotName,
  StateOf,
  TypesOf,
} from "@ui-sdk/core"
import {
  applyAttrs,
  attrs as partAttrs,
  bind,
  conditional,
  partState,
  present as isPresent,
  releaseAttrs,
  sameSlotState,
  selectedKeys,
  subscribe,
  takeOwnId,
} from "@ui-sdk/core/renderer"

// One counter per app, so ids match between the server and the browser and a
// server never shares one across requests.
@Injectable({ providedIn: "root" })
class Ids {
  readonly #app = inject(APP_ID)
  #count = 0

  next() {
    return `ui-sdk-${this.#app}-${this.#count++}`
  }
}

// An id for a part that needs one and wasn't given a value, like an accordion's item.
const useId = () => inject(Ids).next()

/**
 * What `usePrimitive` returns, and what a root directive holds for its parts.
 * @experimental
 */
type PrimitiveHandle<P extends Primitive> = {
  /** The core instance, made the first time something reads it. */
  readonly instance: ReturnType<P>
  /** The methods its definition declares, like Tabs' `setValue`. */
  readonly api: TypesOf<P>["api"]
}

/**
 * Creates the instance for a root directive's life. Call it in a field
 * initializer. `options` is read in an effect, so the inputs it reads stay
 * in sync.
 * @experimental
 */
function usePrimitive<P extends Primitive>(
  primitive: P,
  options: () => OptionsOf<P>
) {
  const id = inject(Ids).next()
  let instance: ReturnType<P> | undefined
  // Inputs arrive after the constructor, so the instance waits for a reader.
  const make = () =>
    (instance ??= primitive({ ...untracked(options), id }) as ReturnType<P>)
  effect(() => {
    const next = options()
    untracked(() => make().setOptions({ ...next, id }))
  })
  inject(DestroyRef).onDestroy(() => instance?.destroy())
  const handle: PrimitiveHandle<P> = {
    get instance() {
      return make()
    },
    get api() {
      return make().api as TypesOf<P>["api"]
    },
  }
  return handle
}

const sameState = (a: object, b: object) => {
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      sameSlotState(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    )
  )
}

/**
 * Binds the directive's element to one part of a component. Call it in a
 * field initializer. On an element, the part stays in the page and is hidden
 * while it isn't present. On an `<ng-template>`, which the `*` form makes,
 * the element exists only while the part is present.
 * @experimental
 */
function usePart<P extends Primitive, S extends SlotName<P>>(
  owner: PrimitiveHandle<P>,
  slot: S,
  props: () => PropsOf<P, S> = () => ({}) as PropsOf<P, S>
) {
  const host =
    inject<ElementRef<HTMLElement | Comment>>(ElementRef).nativeElement
  const template = inject(TemplateRef, { optional: true })
  const container = template ? inject(ViewContainerRef) : undefined
  const channel = `render:${inject(Ids).next()}`
  const part = computed(() => owner.instance.part(slot, props()))
  const element = signal(template ? null : (host as HTMLElement))
  const changes = signal(0)
  // What `let` reads in the `*` form, like `*uiDialogContent="let dialog"`.
  const context = {
    get $implicit() {
      return state()
    },
  }
  let view: EmbeddedViewRef<unknown> | undefined
  let inPage = false
  let shown = false
  let bound: { el: HTMLElement; part: unknown; unbind: () => void } | undefined

  const unbind = () => {
    const current = bound
    bound = undefined
    current?.unbind()
  }

  // Core writes the attributes and binds the element itself, so a state
  // change reaches the page without change detection.
  const sync = () => {
    const el = untracked(element)
    if (!el) {
      return
    }
    const current = untracked(part)
    const present = isPresent(current)
    const attrs = partAttrs(current)
    if (present) {
      if (
        attrs["hidden"] === undefined &&
        (conditional(current) || "hidden" in attrs)
      ) {
        el.removeAttribute("hidden")
      }
      applyAttrs(el, attrs, channel)
    } else {
      if (shown) {
        applyAttrs(el, attrs, channel)
      }
      el.setAttribute("hidden", "")
      if (attrs["data-slot"]) {
        el.setAttribute("data-slot", attrs["data-slot"])
      }
    }
    shown = present
    if (bound && (!present || bound.el !== el || bound.part !== current)) {
      unbind()
    }
    if (inPage && present && !bound) {
      const binding = { el, part: current, unbind: () => {} }
      bound = binding
      binding.unbind = bind(current, el)
    }
  }

  const render = () => {
    if (!template || !container) {
      return
    }
    const present = isPresent(untracked(part))
    if (present && !view) {
      view = container.createEmbeddedView(template, context)
      const root = view.rootNodes.find(
        (node: Node): node is HTMLElement => node.nodeType === 1
      )
      element.set(root ?? null)
    } else if (!present && view) {
      unbind()
      container.clear()
      view = undefined
      shown = false
      element.set(null)
    }
  }

  effect((onCleanup) => {
    const current = part()
    selectedKeys(current)
    const unsubscribe = untracked(() =>
      subscribe(current, (liveOnly: boolean) => {
        if (liveOnly && !conditional(current)) {
          return
        }
        if (!template) {
          sync()
        }
        changes.update((count) => count + 1)
      })
    )
    onCleanup(unsubscribe)
  })

  effect(() => {
    changes()
    part()
    element()
    untracked(() => {
      render()
      const el = element()
      const id = el?.getAttribute("id")
      if (!shown && id) {
        takeOwnId(part(), id)
      }
      sync()
    })
  })

  afterRenderEffect(() => {
    element()
    inPage = true
    untracked(sync)
  })

  inject(DestroyRef).onDestroy(() => {
    unbind()
    const el = untracked(element)
    if (el) {
      releaseAttrs(el, channel)
    }
  })

  const state: Signal<StateOf<P, S>> = computed(
    () => {
      changes()
      return partState(part()) as StateOf<P, S>
    },
    { equal: (a, b) => sameState(a as object, b as object) }
  )
  const present = computed(() => {
    changes()
    return isPresent(part())
  })
  return { present, state }
}

export { type PrimitiveHandle, useId, usePart, usePrimitive }
