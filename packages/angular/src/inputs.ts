import { booleanAttribute, numberAttribute } from "@angular/core"

// An input left out stays undefined, so core's default applies, and a bare
// attribute like `disabled` reads as true.
const optionalBoolean = (value: unknown) =>
  value === undefined ? undefined : booleanAttribute(value)

// A number written as an attribute arrives as a string.
const optionalNumber = (value: unknown) =>
  value === undefined ? undefined : numberAttribute(value)

export { optionalBoolean, optionalNumber }
