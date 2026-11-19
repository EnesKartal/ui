import {
  Component,
  inject,
  InjectionToken,
  Injector,
  ViewContainerRef,
} from "@angular/core"
import type { Primitive, PropsOf, SlotName } from "@ui-sdk/core"
import { usePart, type Joined, type PrimitiveHandle } from "./use-primitive"

const NativeInputPart = new InjectionToken<() => void>("ui-sdk native input")

@Component({ selector: "input", template: "" })
class NativeInput {
  constructor() {
    inject(NativeInputPart)()
  }
}

// Adds the hidden native <input> a control submits through, right after the
// directive's element, so it's in the server's HTML and takes part in a form
// before hydration. Call it in a field initializer.
function useNativeInput<P extends Primitive, S extends SlotName<P>>(
  owner: PrimitiveHandle<P>,
  slot: S,
  props?: () => PropsOf<P, S>,
  joined?: Joined
) {
  const injector = Injector.create({
    providers: [
      {
        provide: NativeInputPart,
        useValue: () => usePart(owner, slot, props, { joined }),
      },
    ],
    parent: inject(Injector),
  })
  return inject(ViewContainerRef).createComponent(NativeInput, { injector })
}

export { useNativeInput }
