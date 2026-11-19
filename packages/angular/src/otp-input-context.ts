import { Directive, ElementRef, inject, InjectionToken } from "@angular/core"
import type { otpInput } from "@ui-sdk/core/otp-input"
import { useFieldControl } from "./field-context"
import { usePart, type PrimitiveHandle } from "./use-primitive"

type OTPInputScope = {
  handle: PrimitiveHandle<typeof otpInput>
  /** The attributes the author gave the root, which its input takes. */
  named: Record<string, string>
}

const OTPInputScope = new InjectionToken<OTPInputScope>("ui-sdk otp input")

// The one real input, over the slots, which takes focus and joins the field.
@Directive({ selector: "input[uiOTPInputControl]" })
class OTPInputControl {
  constructor() {
    const root = inject(OTPInputScope)
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
    for (const [name, value] of Object.entries(root.named)) {
      el.setAttribute(name, value)
    }
    const field = useFieldControl(() => ({
      id: root.named["id"],
      describedBy: root.named["aria-describedby"],
    }))
    usePart(root.handle, "control", undefined, { joined: field?.joined })
  }
}

export { OTPInputControl, OTPInputScope }
