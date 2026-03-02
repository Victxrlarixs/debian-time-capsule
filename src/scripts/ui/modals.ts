// src/scripts/modals.ts

import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';

/**
 * @fileoverview CDE-style modal dialogs
 * Replaces alert, confirm, and prompt with themed, centered windows.
 */

/**
 * Configuration interface for modal dialog buttons.
 */
export interface ModalButton {
  /** The text displayed on the button */
  label: string;
  /** The value returned when this button is clicked (defaults to label if not specified) */
  value?: any;
  /** Whether this button should have the default (highlighted) style */
  isDefault?: boolean;
}

/**
 * CDE Modal Dialog Manager
 *
 * @class
 * @description
 * Provides a unified interface for creating and managing retro-styled modal dialogs
 * that match the CDE aesthetic. Supports alert, confirm, and prompt dialogs with
 * customizable buttons and content.
 *
 * The modal system ensures proper z-index layering, handles cleanup of previous
 * modal instances, and provides Promise-based asynchronous interaction.
 *
 * @example
 * ```typescript
 * // Alert dialog
 * await CDEModal.alert('Operation completed successfully');
 *
 * // Confirm dialog
 * const confirmed = await CDEModal.confirm('Delete this file?');
 * if (confirmed) { // Handle deletion }
 *
 * // Prompt dialog
 * const username = await CDEModal.prompt('Enter your name:', 'Guest');
 * if (username) { // Use input value }
 *
 * // Custom dialog
 * const result = await CDEModal.open(
 *   'Custom Dialog',
 *   '<p>Choose an option:</p>',
 *   [
 *     { label: 'Option A', value: 'A' },
 *     { label: 'Option B', value: 'B', isDefault: true },
 *     { label: 'Cancel', value: null }
 *   ]
 * );
 * ```
 */
class CDEModalClass {
  private modalElement: HTMLElement | null = null;
  private currentResolver: ((value: any) => void) | null = null;
  private zIndex: number = 99000;

  /**
   * Initializes or reuses the CDE modal instance.
   *
   * @returns {HTMLElement} The modal DOM element
   *
   * @remarks
   * If an existing modal is found in the DOM, it is cloned and cleaned
   * to remove any Style Manager artifacts. If no modal exists, a new one
   * is created from scratch.
   *
   * The close button is automatically wired to close the modal.
   */
  private getModal(): HTMLElement {
    // Check if modal already exists and is still in the DOM
    if (this.modalElement && document.body.contains(this.modalElement)) {
      logger.log('[CDEModal] Reusing existing modal element');
      return this.modalElement;
    }

    logger.log('[CDEModal] Creating new modal instance');
    const existing = document.querySelector('.cde-retro-modal');

    if (existing) {
      logger.log('[CDEModal] Cloning existing modal and cleaning artifacts');
      // Clone and clean up residuals
      this.modalElement = existing.cloneNode(true) as HTMLElement;
      this.modalElement.id = 'cde-modal-global';
      this.modalElement.classList.add('cde-modal-global');

      // Remove Style Manager and specialized artifacts
      this.modalElement.querySelector('.cde-sidepanel')?.remove();
      this.modalElement.querySelector('.cde-statusbar')?.remove();
      this.modalElement.querySelector('.cde-menubar')?.remove();
      this.modalElement
        .querySelectorAll(
          '.cde-controlgroup, .cde-controlpanel, .cde-presets, .cde-preset-row, .cde-subtitle, .cde-menu-item'
        )
        .forEach((el) => el.remove());

      // Clean body content
      const body = this.modalElement.querySelector('.modal-body');
      if (body) {
        body.innerHTML = '';
      }

      // Clean action bar
      let actionbar = this.modalElement.querySelector('.cde-actionbar');
      if (!actionbar) {
        actionbar = document.createElement('div');
        actionbar.className = 'cde-actionbar';
        this.modalElement.appendChild(actionbar);
      } else {
        actionbar.innerHTML = '';
      }
    } else {
      logger.log('[CDEModal] Creating new modal from scratch');
      this.modalElement = document.createElement('div');
      this.modalElement.className = 'cde-retro-modal cde-modal-global';
      this.modalElement.id = 'cde-modal-global';

      const titlebar = document.createElement('div');
      titlebar.className = 'titlebar';
      titlebar.innerHTML = `
        <span class="titlebar-text">CDE Dialog</span>
        <div class="close-btn">
          <img src="/icons/ui/tab_close.png">
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'modal-body';

      const actionbar = document.createElement('div');
      actionbar.className = 'cde-actionbar';

      this.modalElement.appendChild(titlebar);
      this.modalElement.appendChild(body);
      this.modalElement.appendChild(actionbar);
    }

    const closeBtn = this.modalElement.querySelector('.close-btn');
    if (closeBtn) {
      (closeBtn as HTMLElement).onclick = (e: MouseEvent) => {
        e.stopPropagation();
        logger.log('[CDEModal] Close button clicked');
        this.close();
      };
    }

    // --- INTEGRATION: Make modal draggable via its titlebar ---
    const titlebarEl = this.modalElement.querySelector('.titlebar');
    if (titlebarEl) {
      (titlebarEl as HTMLElement).onpointerdown = (e: PointerEvent) => {
        if (!(e.target as HTMLElement).closest('.close-btn')) {
          WindowManager.drag(e, this.modalElement!.id);
        }
      };
    }

    document.body.appendChild(this.modalElement);
    logger.log('[CDEModal] Modal appended to DOM');
    return this.modalElement;
  }

  /**
   * Opens a modal dialog with custom content and buttons.
   *
   * @param title - The title displayed in the modal's title bar
   * @param content - HTML content for the modal body
   * @param buttons - Array of button configurations (defaults to single Accept button)
   * @returns Promise that resolves with the value of the clicked button
   *
   * @remarks
   * The modal is displayed with proper z-index management. The returned Promise
   * resolves when any button is clicked or the modal is closed.
   */
  public open(
    title: string,
    content: string,
    buttons: ModalButton[] = [{ label: 'Accept', value: true }]
  ): Promise<any> {
    logger.log(`[CDEModal] Opening dialog: "${title}" with ${buttons.length} buttons`);
    const modal = this.getModal();

    const titleEl = modal.querySelector('.titlebar-text') as HTMLElement;
    if (titleEl) titleEl.textContent = title;

    const body = modal.querySelector('.modal-body') as HTMLElement;
    body.innerHTML = content;

    const actionbar = modal.querySelector('.cde-actionbar') as HTMLElement;
    actionbar.innerHTML = '';

    return new Promise((resolve) => {
      this.currentResolver = resolve;

      buttons.forEach((btn, index) => {
        const button = document.createElement('button');
        button.className = `cde-btn ${btn.isDefault ? 'cde-btn-default' : ''}`;
        button.textContent = btn.label;
        button.onclick = (e) => {
          e.stopPropagation();
          const value = btn.value !== undefined ? btn.value : btn.label;
          logger.log(`[CDEModal] Button "${btn.label}" clicked, resolving with value:`, value);
          this.close();
          resolve(value);
        };
        actionbar.appendChild(button);
        logger.log(`[CDEModal] Added button ${index + 1}/${buttons.length}: "${btn.label}"`);
      });

      modal.style.display = 'flex';
      const newZIndex = WindowManager.getNextZIndex(true);
      modal.style.zIndex = String(newZIndex);

      requestAnimationFrame(() => {
        WindowManager.centerWindow(modal);
      });

      logger.log(`[CDEModal] Modal displayed with z-index: ${newZIndex}`);
    });
  }

  /** Closes the modal and cleans up the resolver. */
  public close(): void {
    logger.log('[CDEModal] Closing modal');
    if (this.modalElement) {
      this.modalElement.style.display = 'none';
      this.currentResolver = null;
      logger.log('[CDEModal] Modal closed and hidden');
    } else {
      console.warn('[CDEModal] Attempted to close modal but no modal element exists');
    }
  }

  /**
   * Displays an alert dialog with a single "Accept" button.
   *
   * @param message - The message to display in the alert
   * @returns Promise that resolves when the alert is acknowledged
   *
   * @example
   * ```typescript
   * await CDEModal.alert('File saved successfully');
   * ```
   */
  public async alert(message: string): Promise<void> {
    logger.log('[CDEModal] Displaying alert:', message);
    await this.open('CDE Alert', `<p style="margin:0;">${message}</p>`);
    logger.log('[CDEModal] Alert acknowledged');
  }

  /**
   * Displays a confirmation dialog with Accept and Cancel buttons.
   *
   * @param question - The question to ask the user
   * @returns Promise resolving to true if Accept clicked, false if Cancel clicked
   *
   * @example
   * ```typescript
   * if (await CDEModal.confirm('Delete this item?')) {
   *   // Perform deletion
   * }
   * ```
   */
  public async confirm(question: string): Promise<boolean> {
    logger.log('[CDEModal] Displaying confirm dialog:', question);
    const result = await this.open('CDE Confirm', `<p style="margin:0;">${question}</p>`, [
      { label: 'Accept', value: true, isDefault: true },
      { label: 'Cancel', value: false },
    ]);
    logger.log(`[CDEModal] Confirm result: ${result}`);
    return result;
  }

  /**
   * Displays a prompt dialog with a text input field.
   *
   * @param question - The prompt question
   * @param defaultValue - Optional default value for the input field
   * @returns Promise resolving to the input value if Accept clicked, null if Cancel clicked
   *
   * @example
   * ```typescript
   * const name = await CDEModal.prompt('Enter your name:', 'Guest');
   * if (name) {
   *   logger.log(`Hello, ${name}!`);
   * }
   * ```
   */
  public async prompt(question: string, defaultValue: string = ''): Promise<string | null> {
    logger.log(`[CDEModal] Displaying prompt dialog: "${question}" (default: "${defaultValue}")`);

    const content = `
      <p style="margin:0 0 10px 0;">${question}</p>
      <input type="text" id="cde-prompt-input" value="${defaultValue}">
    `;

    // Use open with special values to interpret later
    const result = await this.open('CDE Prompt', content, [
      { label: 'Accept', value: 'ACCEPT', isDefault: true },
      { label: 'Cancel', value: 'CANCEL' },
    ]);

    if (result === 'ACCEPT') {
      const input = document.getElementById('cde-prompt-input') as HTMLInputElement;
      const inputValue = input ? input.value : null;
      logger.log(`[CDEModal] Prompt accepted with value: "${inputValue}"`);
      return inputValue;
    }

    logger.log('[CDEModal] Prompt cancelled');
    return null;
  }
}

/**
 * Singleton instance of the CDE Modal manager.
 *
 * @remarks
 * This is the main export for the modal system. Use this instance
 * throughout the application for all modal dialogs.
 *
 * The instance is also exposed globally as `window.CDEModal` for
 * compatibility with inline HTML event handlers.
 */
export const CDEModal = new CDEModalClass();

// Expose globally for HTML inline handlers and debugging
if (typeof window !== 'undefined') {
  (window as any).CDEModal = CDEModal;
  logger.log('[CDEModal] Global instance attached to window');
}

export default CDEModal;
