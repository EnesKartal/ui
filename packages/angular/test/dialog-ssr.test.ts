// @vitest-environment node
import { Component } from "@angular/core"
import { describe, expect, test } from "vitest"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../src/dialog"
import { render, tagWith } from "./render"

const imports = [
  Dialog,
  DialogTrigger,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
]

@Component({
  selector: "test-root",
  imports,
  template: `
    <ng-container uiDialog defaultOpen>
      <button uiDialogTrigger>Open</button>
      <div *uiDialogBackdrop class="backdrop"></div>
      <div *uiDialogContent class="content">
        <h2 uiDialogTitle>Profile</h2>
        <p uiDialogDescription>About you</p>
        <button uiDialogClose>Close</button>
      </div>
    </ng-container>
  `,
})
class Open {}

@Component({
  selector: "test-root",
  imports: [Dialog, DialogTrigger, DialogBackdrop, DialogContent, DialogTitle],
  template: `
    <ng-container uiDialog>
      <button uiDialogTrigger>Open</button>
      <div uiDialogBackdrop class="backdrop"></div>
      <div uiDialogContent class="kept"><h2 uiDialogTitle>Kept</h2></div>
      <div *uiDialogContent class="lazy"><h2 uiDialogTitle>Lazy</h2></div>
    </ng-container>
  `,
})
class Closed {}

// Runs with no DOM globals: a read of window or document while rendering throws.
describe("server rendering a dialog", () => {
  test("an open dialog renders named by its title", async () => {
    const html = await render(Open)
    expect(typeof window).toBe("undefined")
    const content = html.match(/<div[^>]*class="content"[^>]*>/)?.[0] ?? ""
    const title = tagWith(html, "Profile").match(/ id="([^"]+)"/)?.[1]
    expect(title).toBeTruthy()
    expect(content).toContain('role="dialog"')
    expect(content).toContain(`aria-labelledby="${title}"`)
    expect(html).toMatch(/<div[^>]*class="backdrop"[^>]*data-open=""/)
    expect(tagWith(html, "Close")).toContain('type="button"')
  })

  test("a closed dialog is hidden, and the star form leaves it out", async () => {
    const html = await render(Closed)
    expect(html).toMatch(/<div[^>]*class="kept"[^>]*hidden=""/)
    expect(html).toMatch(/<div[^>]*class="backdrop"[^>]*hidden=""/)
    expect(html).not.toContain("Lazy")
    expect(tagWith(html, "Open")).toContain('aria-haspopup="dialog"')
  })
})
