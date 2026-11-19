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
  Attrs,
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

// The first part of a slot keeps core's own key, so the ids other parts point
// at before anything binds, like a field label's, are the ones it renders.
// Another part of that slot, like a dialog's second Close, takes its own.
const lone = new WeakMap<object, Map<string, string>>()

function claim(instance: object, slot: string, holder: string) {
  const slots = lone.get(instance) ?? new Map<string, string>()
  lone.set(instance, slots)
  if (!slots.has(slot)) {
    slots.set(slot, holder)
  }
  return slots.get(slot) === holder
}

function release(instance: object, slot: string, holder: string) {
  const slots = lone.get(instance)
  if (slots?.get(slot) === holder) {
    slots.delete(slot)
  }
}

// A second part on the same element, like a field's control part on a
// switch: its attributes merge into the element's own part and it binds too.
type Joined = {
  part: () => Parameters<typeof partAttrs>[0] | undefined
  merge: (own: Attrs, joined: Attrs) => Attrs
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
  props: () => PropsOf<P, S> = () => ({}) as PropsOf<P, S>,
  joined?: Joined
) {
  const host =
    inject<ElementRef<HTMLElement | Comment>>(ElementRef).nativeElement
  const template = inject(TemplateRef, { optional: true })
  const container = template ? inject(ViewContainerRef) : undefined
  const own = inject(Ids).next()
  const channel = `render:${own}`
  // Core keeps one part per key and gives it the new props, so the same
  // object comes back and only this computed can say that it changed.
  let lone: boolean | undefined
  const part = computed(
    () => {
      const given = props() as PropsOf<P, S> & { id?: string; value?: unknown }
      if (given.value !== undefined || given.id !== undefined) {
        return owner.instance.part(slot, given)
      }
      lone ??= claim(owner.instance, slot, own)
      return owner.instance.part(slot, lone ? given : { ...given, id: own })
    },
    { equal: () => false }
  )
  const keyed = computed(() => part())
  const selection = computed(() => selectedKeys(part()))
  const element = signal(template ? null : (host as HTMLElement))
  const changes = signal(0)
  const stateChanges = signal(0)
  // What `let` reads in the `*` form, like `*uiDialogContent="let dialog"`.
  const context = {
    get $implicit() {
      return state()
    },
  }
  let view: EmbeddedViewRef<unknown> | undefined
  let inPage = false
  let shown = false
  let bound:
    | { el: HTMLElement; part: unknown; joined: unknown; unbind: () => void }
    | undefined

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
    const other = joined && untracked(joined.part)
    const attrs = other
      ? joined.merge(partAttrs(current), partAttrs(other))
      : partAttrs(current)
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
    if (
      bound &&
      (!present ||
        bound.el !== el ||
        bound.part !== current ||
        bound.joined !== other)
    ) {
      unbind()
    }
    if (inPage && present && !bound) {
      const binding = { el, part: current, joined: other, unbind: () => {} }
      bound = binding
      const unbindOwn = bind(current, el)
      const unbindOther = other && bind(other, el)
      binding.unbind = () => {
        unbindOther?.()
        unbindOwn()
      }
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
    const current = keyed()
    selection()
    const unsubscribe = untracked(() =>
      subscribe(current, (liveOnly: boolean) => {
        // A template may read state that only live attributes show, like `pending`.
        stateChanges.update((count) => count + 1)
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

  if (joined) {
    effect((onCleanup) => {
      const other = joined.part()
      if (!other) {
        return
      }
      onCleanup(
        untracked(() =>
          subscribe(other, () => {
            sync()
            changes.update((count) => count + 1)
          })
        )
      )
    })
  }

  effect(() => {
    changes()
    part()
    joined?.part()
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
    if (lone) {
      release(owner.instance, slot, own)
    }
    const el = untracked(element)
    if (el) {
      releaseAttrs(el, channel)
    }
  })

  const state: Signal<StateOf<P, S>> = computed(
    () => {
      stateChanges()
      return partState(part()) as StateOf<P, S>
    },
    { equal: (a, b) => sameState(a as object, b as object) }
  )
  const present = computed(() => {
    stateChanges()
    return isPresent(part())
  })
  return { present, state }
}

export { type Joined, type PrimitiveHandle, useId, usePart, usePrimitive }
