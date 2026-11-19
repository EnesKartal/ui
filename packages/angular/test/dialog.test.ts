// @vitest-environment jsdom
import { Component, signal } from "@angular/core"
import { describe, expect, test } from "vitest"
import {
  Dialog,
  DialogClose,
  type DialogCloseAction,
  DialogContent,
  DialogDescription,
  type DialogOpenChange,
  DialogTitle,
  DialogTrigger,
} from "../src/dialog"
import { mount } from "./mount"

@Component({
  selector: "test-root",
  imports: [
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose,
  ],
  template: `
    <ng-container
      uiDialog
      [(open)]="open"
      (beforeOpenChange)="before($event)"
      (openChangeComplete)="completed.push($event)"
    >
      <button uiDialogTrigger id="trigger" [payload]="'row 7'">Open</button>
      <div *uiDialogContent="let dialog" id="content">
        <h2 uiDialogTitle>Profile</h2>
        <p uiDialogDescription>Editing {{ dialog.payload }}</p>
        <button uiDialogClose id="close" value="cancel">Cancel</button>
        <button
          uiDialogClose
          id="save"
          value="save"
          #save="uiDialogClose"
          (action)="run($event)"
        >
          {{ save.state().pending ? "Saving" : "Save" }}
        </button>
      </div>
    </ng-container>
  `,
})
class Page {
  readonly open = signal(false)
  readonly changes: string[] = []
  readonly completed: boolean[] = []
  readonly sources: string[] = []
  locked = false
  wait: Promise<unknown> | undefined

  before(change: DialogOpenChange) {
    this.changes.push(
      `${change.reason}:${change.value}:${change.returnValue ?? ""}`
    )
    if (this.locked) {
      change.cancel()
    }
  }

  run(action: DialogCloseAction) {
    this.sources.push(typeof action.event)
    if (this.wait) {
      action.waitUntil(this.wait)
    }
  }
}

const press = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`#${id}`)!.click()

describe("dialog", () => {
  test("the trigger opens it, named by its title and described by its description", async () => {
    const { host, instance, settle } = await mount(Page)
    expect(host.querySelector("#content")).toBeNull()
    press(host, "trigger")
    await settle()
    const content = host.querySelector("#content")!
    expect(instance.open()).toBe(true)
    expect(instance.changes).toEqual(["trigger-press:true:"])
    expect(content.getAttribute("role")).toBe("dialog")
    expect(content.getAttribute("aria-labelledby")).toBe(
      host.querySelector("h2")!.id
    )
    expect(content.getAttribute("aria-describedby")).toBe(
      host.querySelector("p")!.id
    )
  })

  test("let reads the content's state, like the trigger's payload", async () => {
    const { host, settle } = await mount(Page)
    press(host, "trigger")
    await settle()
    expect(host.querySelector("p")!.textContent).toBe("Editing row 7")
  })

  test("a close press closes it and reports its value", async () => {
    const { host, instance, settle } = await mount(Page)
    instance.open.set(true)
    await settle()
    press(host, "close")
    await settle()
    expect(instance.open()).toBe(false)
    expect(instance.changes).toEqual(["close-press:false:cancel"])
    expect(host.querySelector("#content")).toBeNull()
    expect(instance.completed.at(-1)).toBe(false)
  })

  test("cancel() in (beforeOpenChange) keeps it closed", async () => {
    const { host, instance, settle } = await mount(Page)
    instance.locked = true
    press(host, "trigger")
    await settle()
    expect(instance.open()).toBe(false)
    expect(host.querySelector("#content")).toBeNull()
  })

  test("an (action) listener runs before the close, with reason action", async () => {
    const { host, instance, settle } = await mount(Page)
    instance.open.set(true)
    await settle()
    press(host, "save")
    await settle()
    expect(instance.sources).toEqual(["object"])
    expect(instance.changes).toEqual(["action:false:save"])
    expect(instance.open()).toBe(false)
  })

  test("waitUntil() keeps it open and the button pending until the promise settles", async () => {
    const { host, instance, settle } = await mount(Page)
    let finish = () => {}
    instance.wait = new Promise<void>((resolve) => (finish = resolve))
    instance.open.set(true)
    await settle()
    press(host, "save")
    await settle()
    const save = host.querySelector("#save")!
    expect(instance.open()).toBe(true)
    expect(save.getAttribute("aria-busy")).toBe("true")
    expect(save.textContent?.trim()).toBe("Saving")
    finish()
    await instance.wait
    await settle()
    expect(instance.open()).toBe(false)
    expect(instance.changes).toEqual(["action:false:save"])
  })
})
