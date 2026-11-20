import {
  createComponent,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
  type Type,
} from "@angular/core"
import { createApplication } from "@angular/platform-browser"

const apps = new Set<ApplicationRef>()
let flushing = false

/**
 * A signal for a fixture's own state. Specs read the page as soon as an event
 * returns and Angular renders a frame later, so a write renders in the same task.
 */
function state<T>(initial: T) {
  const value = signal(initial)
  const { set } = value
  value.set = (next) => {
    set(next)
    if (flushing) {
      return
    }
    flushing = true
    queueMicrotask(() => {
      flushing = false
      apps.forEach((app) => app.tick())
    })
  }
  value.update = (change) => value.set(change(value()))
  return value
}

// The fixture's component takes the root as its host, so the page has the
// same elements as in the other frameworks.
async function mountAngular(component: Type<unknown>, root: HTMLElement) {
  const app = await createApplication({
    providers: [provideZonelessChangeDetection()],
  })
  apps.add(app)
  const ref = createComponent(component, {
    environmentInjector: app.injector,
    hostElement: root,
  })
  app.attachView(ref.hostView)
  app.tick()
  return () => {
    apps.delete(app)
    app.destroy()
  }
}

export { mountAngular, state }
