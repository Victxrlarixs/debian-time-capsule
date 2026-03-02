// src/scripts/features/calendar.ts

import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';

/**
 * Calendar Manager for the interactive CDE calendar.
 */
export const CalendarManager = (() => {
  let currentDate = new Date();
  let initialized = false;

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function init(): void {
    if (initialized) return;

    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');

    if (prevBtn) prevBtn.onclick = () => changeMonth(-1);
    if (nextBtn) nextBtn.onclick = () => changeMonth(1);

    render();
    initialized = true;
    logger.log('[CalendarManager] Initialized');
  }

  function render(): void {
    const monthYearEl = document.getElementById('cal-month-year');
    const daysContainer = document.getElementById('cal-days');
    const statusEl = document.getElementById('cal-status');

    if (!monthYearEl || !daysContainer) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYearEl.textContent = `${months[month]} ${year}`;

    if (statusEl) {
      const today = new Date();
      statusEl.textContent = `Today: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    }

    // Clear days
    daysContainer.innerHTML = '';

    // First day of month
    const firstDay = new Date(year, month, 1).getDay();
    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding for empty days
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      daysContainer.appendChild(empty);
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'cal-day';
      dayEl.textContent = day.toString();

      if (isCurrentMonth && day === today.getDate()) {
        dayEl.classList.add('today');
      }

      daysContainer.appendChild(dayEl);
    }
  }

  function changeMonth(delta: number): void {
    currentDate.setMonth(currentDate.getMonth() + delta);
    render();
  }

  function open(): void {
    const win = document.getElementById('calendar-window');
    if (win) {
      win.classList.remove('maximized');
      win.style.display = 'flex';
      requestAnimationFrame(() => {
        WindowManager.centerWindow(win);
        if (window.focusWindow) window.focusWindow('calendar-window');
      });
      render();
    }
  }

  function close(): void {
    const win = document.getElementById('calendar-window');
    if (win) win.style.display = 'none';
  }

  function toggle(): void {
    const win = document.getElementById('calendar-window');
    if (win && win.style.display === 'flex') {
      close();
    } else {
      open();
    }
  }

  return { init, open, close, toggle };
})();

// Global exposure
declare global {
  interface Window {
    calendarManager: typeof CalendarManager;
    openCalendar: () => void;
  }
}

window.calendarManager = CalendarManager;
window.openCalendar = CalendarManager.toggle;

export default CalendarManager;
