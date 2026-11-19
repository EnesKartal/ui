import { booleanAttribute } from "@angular/core"

// An input left out stays undefined, so core's default applies, and a bare
// attribute like `disabled` reads as true.
const optionalBoolean = (value: unknown) =>
  value === undefined ? undefined : booleanAttribute(value)

export { optionalBoolean }
