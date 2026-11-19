import { booleanAttribute, numberAttribute } from "@angular/core"

// An input left out stays undefined, so core's default applies, and a bare
// attribute like `disabled` reads as true.
const optionalBoolean = (value: unknown) =>
  value === undefined ? undefined : booleanAttribute(value)

// A number written as an attribute arrives as a string.
const optionalNumber = (value: unknown) =>
  value === undefined ? undefined : numberAttribute(value)

// A number that may be `null`, like a rating with no score yet.
const nullableNumber = (value: unknown) =>
  value === undefined || value === null
    ? (value as null | undefined)
    : numberAttribute(value)

export { nullableNumber, optionalBoolean, optionalNumber }
