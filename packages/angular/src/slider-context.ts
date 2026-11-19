import { Directive, ElementRef, inject, InjectionToken } from "@angular/core"
import type { slider } from "@ui-sdk/core/slider"
import { useFieldControl } from "./field-context"
import { usePart, type PrimitiveHandle } from "./use-primitive"

type SliderThumbScope = {
  handle: PrimitiveHandle<typeof slider>
  /** The props the thumb and its input share. */
  key: () => { index: number; id: string }
  /** The names the author gave the thumb, which its input takes. */
  named: Record<string, string>
  /** Whether the input is the field's control: a range's root is instead. */
  inField: () => boolean
}

const SliderThumbScope = new InjectionToken<SliderThumbScope>(
  "ui-sdk slider thumb"
)

// The native range input inside a thumb, which takes focus and joins the field.
@Directive({ selector: "input[uiSliderThumbInput]" })
class SliderThumbInput {
  constructor() {
    const thumb = inject(SliderThumbScope)
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
    for (const [name, value] of Object.entries(thumb.named)) {
      el.setAttribute(name, value)
    }
    const field = useFieldControl(() => ({
      id: field?.controlId(),
      describedBy: thumb.named["aria-describedby"],
    }))
    usePart(
      thumb.handle,
      "thumb-input",
      thumb.key,
      field && {
        ...field.joined,
        part: () => (thumb.inField() ? field.joined.part() : undefined),
      }
    )
  }
}

export { SliderThumbInput, SliderThumbScope }
