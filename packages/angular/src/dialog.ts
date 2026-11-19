import {
  Directive,
  inject,
  input,
  output,
  type InputSignal,
} from "@angular/core"
import {
  dialog,
  type DialogContentState,
  type DialogController,
  type DialogDismissAttemptDetails,
  type DialogFinalFocus,
  type DialogInitialFocus,
  type DialogOpenChangeDetails,
  type DialogPayloadChangeReason,
} from "@ui-sdk/core/dialog"
import { optionalBoolean } from "./inputs"
import { ActionEmitter, emitChange, type Action, type Change } from "./outputs"
import { usePart, usePrimitive } from "./use-primitive"

/**
 * What `(beforeOpenChange)` emits: whether the dialog is about to open, why,
 * what closed it reported, and `cancel()` to leave it as it is.
 * @experimental
 */
type DialogOpenChange = DialogOpenChangeDetails & {
  /** Whether the dialog would be open. */
  value: boolean
}

/**
 * What `(beforePayloadChange)` emits: the payload the content is about to
 * show, why, and `cancel()` to keep the previous one.
 * @experimental
 */
type DialogPayloadChange = Change<unknown, DialogPayloadChangeReason>

/**
 * What a Close part's `(action)` emits: the press, how it was made, and `waitUntil()`.
 * @experimental
 */
type DialogCloseAction = Action

const modalSetting = (value: unknown) =>
  value === "trap-focus" ? ("trap-focus" as const) : optionalBoolean(value)

/**
 * A window over the page that asks for the user's attention. Put its trigger,
 * backdrop and content inside. It has no element of its own, so it can sit on
 * an `<ng-container>`.
 * @experimental
 */
@Directive({ selector: "[uiDialog]", exportAs: "uiDialog" })
class Dialog {
  /** Whether the dialog is open. Bind it with `[(open)]` to control the dialog. */
  readonly open = input(undefined, { transform: optionalBoolean })
  /** Whether the dialog starts open, when uncontrolled. Focus moves into it once it's on the page. */
  readonly defaultOpen = input(undefined, { transform: optionalBoolean })
  /** `true`: the rest of the page is inert and doesn't scroll, focus is trapped, and an outside press only closes the dialog. `"trap-focus"`: traps focus, and leaves the page scrollable and clickable. `false`: a dialog beside the page, which Tab can leave and outside presses don't close. */
  readonly modal = input(undefined, { transform: modalSetting })
  /** Whether pressing outside the dialog, like on its backdrop, closes it. The press counts once it's released outside too. */
  readonly closeOnOutsidePress = input(undefined, {
    transform: optionalBoolean,
  })
  /** Whether Escape, an outside press and Android's back gesture can close the dialog. Close parts, triggers and the controller always can. */
  readonly dismissible = input(undefined, { transform: optionalBoolean })
  /** Elements that stay usable while the dialog makes the page inert. Elements, CSS selectors, or a function that returns elements, read when the dialog opens. */
  readonly persistentElements = input<
    (Element | string)[] | (() => Element[])
  >()
  /** What screen readers hear once a Close part's action has been running for a second. Set it in the page's language. An empty string says nothing. */
  readonly pendingAnnouncement = input<string>()
  /** Opens, closes and inspects the dialog from anywhere. Create one with `createDialogController()`. */
  readonly controller = input<DialogController<any, any>>()
  /** Whether the dialog is open, after a change that wasn't canceled. */
  readonly openChange = output<boolean>()
  /** Runs before the dialog opens or closes, with the reason, what closed it reported and `cancel()`. */
  readonly beforeOpenChange = output<DialogOpenChange>()
  /** Runs once the dialog has finished opening or closing, after any animation. */
  readonly openChangeComplete = output<boolean>()
  /** The payload the content shows, after a change that wasn't canceled. */
  readonly payloadChange = output<unknown>()
  /** Runs before the payload the content shows changes, with the reason and `cancel()`. */
  readonly beforePayloadChange = output<DialogPayloadChange>()
  /** Runs when a dismissal was refused, because `dismissible` is false, an outside press doesn't close it, or a Close part's action is running. */
  readonly dismissAttempt = output<DialogDismissAttemptDetails>()

  readonly handle = usePrimitive(dialog, () => ({
    open: this.open(),
    defaultOpen: this.defaultOpen(),
    modal: this.modal(),
    closeOnOutsidePress: this.closeOnOutsidePress(),
    dismissible: this.dismissible(),
    persistentElements: this.persistentElements(),
    pendingAnnouncement: this.pendingAnnouncement(),
    controller: this.controller(),
    onOpenChange: emitChange(this.beforeOpenChange, this.openChange),
    onOpenChangeComplete: (open) => this.openChangeComplete.emit(open),
    onPayloadChange: emitChange(this.beforePayloadChange, this.payloadChange),
    onDismissAttempt: (details) => this.dismissAttempt.emit(details),
  }))
}

/**
 * The button that opens the dialog.
 * @experimental
 */
@Directive({ selector: "[uiDialogTrigger]", exportAs: "uiDialogTrigger" })
class DialogTrigger {
  /** Stops the trigger from opening the dialog. A native button can't be focused or pressed, unless `focusableWhenDisabled` is set. */
  readonly disabled = input(undefined, { transform: optionalBoolean })
  /** Keeps a disabled trigger in the tab order with `aria-disabled` instead of the native attribute, so it can host a tooltip that says why. */
  readonly focusableWhenDisabled = input(undefined, {
    transform: optionalBoolean,
  })
  /** Data for the content to render when this trigger opens the dialog, like the row it belongs to. */
  readonly payload = input<unknown>()
  /** A keyboard shortcut that presses the trigger, like `"mod+k"`. `mod` is Command on Apple platforms and Control elsewhere. */
  readonly shortcut = input<string>()
  /** The trigger's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "trigger", () => ({
    disabled: this.disabled(),
    focusableWhenDisabled: this.focusableWhenDisabled(),
    payload: this.payload(),
    shortcut: this.shortcut(),
  })).state
}

/**
 * A layer between the page and the dialog, shown while it's open. Closed, it
 * stays in the page, hidden. `*uiDialogBackdrop` renders it only while the dialog is open.
 * @experimental
 */
@Directive({ selector: "[uiDialogBackdrop]", exportAs: "uiDialogBackdrop" })
class DialogBackdrop {
  /** The backdrop's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "backdrop").state
}

/**
 * The dialog itself, named by its title and described by its description.
 * Closed, it stays in the page, hidden. `*uiDialogContent` renders it only
 * while the dialog is open, and `*uiDialogContent="let dialog"` reads its state.
 * @experimental
 */
@Directive({ selector: "[uiDialogContent]", exportAs: "uiDialogContent" })
class DialogContent {
  /** Where focus goes when the dialog opens. Opening with touch focuses the dialog itself, so no on-screen keyboard appears. */
  readonly initialFocus = input<DialogInitialFocus>()
  /** Where focus goes when the dialog closes while focus is inside it. */
  readonly finalFocus: InputSignal<DialogFinalFocus | undefined> = input()
  /** Whether the `*` form keeps the dialog in the page, hidden, while closed. */
  readonly keepMounted = input(undefined, { transform: optionalBoolean })
  /** Renders the dialog and its backdrop where they are in the page instead of above it, so it can stay inside a frame, like an app preview. */
  readonly inline = input(undefined, { transform: optionalBoolean })
  /** The dialog's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "content", () => ({
    initialFocus: this.initialFocus(),
    finalFocus: this.finalFocus(),
    keepMounted: this.keepMounted(),
    inline: this.inline(),
  })).state

  static ngTemplateContextGuard(
    _directive: DialogContent,
    context: unknown
  ): context is { $implicit: DialogContentState } {
    return true
  }
}

/**
 * The dialog's name, which screen readers announce when it opens. Put it on a heading.
 * @experimental
 */
@Directive({ selector: "[uiDialogTitle]", exportAs: "uiDialogTitle" })
class DialogTitle {
  /** The title's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "title").state
}

/**
 * Text that says more about the dialog, read after its title.
 * @experimental
 */
@Directive({
  selector: "[uiDialogDescription]",
  exportAs: "uiDialogDescription",
})
class DialogDescription {
  /** The description's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "description").state
}

/**
 * A button that closes the dialog. With an `(action)` listener, the press
 * runs it first: pass a Promise to `$event.waitUntil()` to keep the dialog
 * open, and the button pending, until it settles.
 * @experimental
 */
@Directive({
  selector: "[uiDialogClose]",
  exportAs: "uiDialogClose",
  outputs: ["action"],
})
class DialogClose {
  /** Reported as `returnValue` in `(beforeOpenChange)` and by the controller's `open()`. */
  readonly value = input<string>()
  /** Runs when the button is pressed, before the dialog closes. */
  readonly action = new ActionEmitter()
  /** The button's state, as a signal. */
  readonly state = usePart(inject(Dialog).handle, "close", () => ({
    value: this.value(),
    action: this.action.handler(),
  })).state
}

export { createDialogController } from "@ui-sdk/core/dialog"
export type {
  DialogApi,
  DialogBackdropState,
  DialogCloseProps,
  DialogCloseState,
  DialogContentProps,
  DialogContentState,
  DialogController,
  DialogDismissAttemptDetails,
  DialogDismissReason,
  DialogFinalFocus,
  DialogInitialFocus,
  DialogOpenChangeDetails,
  DialogOpenChangeReason,
  DialogOptions,
  DialogPayloadChangeReason,
  DialogPrimitive,
  DialogTriggerProps,
  DialogTriggerState,
} from "@ui-sdk/core/dialog"

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  type DialogCloseAction,
  DialogContent,
  DialogDescription,
  type DialogOpenChange,
  type DialogPayloadChange,
  DialogTitle,
  DialogTrigger,
}
