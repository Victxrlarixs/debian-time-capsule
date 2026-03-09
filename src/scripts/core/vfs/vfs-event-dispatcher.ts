export class VFSEventDispatcher {
  /** Dispatches a filesystem change event. */
  dispatchChange(path: string): void {
    window.dispatchEvent(
      new CustomEvent('cde-fs-change', {
        detail: { path },
      })
    );
  }
}
