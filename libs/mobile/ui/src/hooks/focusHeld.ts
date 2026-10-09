/**
 * Whether an inert control — disabled, or busy — is disabled as far as the
 * native view is told.
 *
 * Not while it is where keyboard focus is. Android takes focus from a view as
 * it is disabled and gives it to the first focusable view in the window, so a
 * control that went inert under the keyboard lost the keyboard's place: a
 * checkbox disabled for the length of the save its own tick started (#1068),
 * and a sheet whose buttons all went busy at once, which got focus back on
 * the first of them and not the one that was pressed (#1085).
 *
 * So the view is told nothing for as long as it holds focus. The control
 * stays dimmed and refuses the press itself, and is disabled for real once
 * focus moves on. Never so after a touch or on iOS, where no control is told
 * it has focus (see `useFocusRing`).
 */
export function disabledNatively(inert: boolean, focused: boolean): boolean {
  return inert && !focused;
}
