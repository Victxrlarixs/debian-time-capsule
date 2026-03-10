import { CONFIG } from '../core/config';
import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';

// ============================================================================
// Process Monitor - Live updating htop-style process viewer
// ============================================================================

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: string;
  mem: string;
  elementId: string | null;
  visible: boolean;
  isModal: boolean;
}

function scanProcesses(): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  const activeWindows = document.querySelectorAll('.window, .cde-retro-modal');
  let pidCount = 1000;

  activeWindows.forEach((win) => {
    const el = win as HTMLElement;
    if (el.id === 'process-monitor') return;

    const isVisible = el.style.display !== 'none';
    const titleEl = el.querySelector('.titlebar-text');
    let name = el.id || 'Window';

    if (el.id === 'terminal') name = 'Terminal';
    else if (el.id === 'fm') name = 'File Manager';
    else if (el.id === 'appManager') name = 'App Manager';
    else if (titleEl) name = titleEl.textContent || name;

    processes.push({
      pid: pidCount++,
      name,
      cpu: (Math.random() * 5 + 0.1).toFixed(1),
      mem: (Math.random() * 10 + 2).toFixed(1),
      elementId: el.id,
      visible: isVisible,
      isModal: el.classList.contains('cde-retro-modal'),
    });
  });

  processes.push(
    {
      pid: 1,
      name: 'init',
      cpu: '0.3',
      mem: '1.2',
      elementId: null,
      visible: true,
      isModal: false,
    },
    {
      pid: 2,
      name: 'kthreadd',
      cpu: '0.0',
      mem: '0.0',
      elementId: null,
      visible: true,
      isModal: false,
    },
    {
      pid: 3,
      name: 'ksoftirqd/0',
      cpu: '0.1',
      mem: '0.0',
      elementId: null,
      visible: true,
      isModal: false,
    }
  );

  return processes;
}

const ProcessMonitor = (() => {
  const WINDOW_ID = 'process-monitor';
  // Removed local zIndex - now using global WindowManager z-index system
  let processes: ProcessInfo[] = [];
  let selectedIndex = 0;
  let contentDiv: HTMLElement | null = null;
  let winElement: HTMLElement | null = null;
  let updateInterval: number | null = null;
  let lastProcessesJSON = '';
  let isOpen = false;

  let timeLoadLine: HTMLElement | null = null;
  let tasksLine: HTMLElement | null = null;
  let memBarFill: HTMLElement | null = null;
  let swapBarFill: HTMLElement | null = null;
  let memTextSpan: HTMLElement | null = null;
  let swapTextSpan: HTMLElement | null = null;
  let rowElements: HTMLElement[] = [];

  function getWindow(): HTMLElement | null {
    if (!winElement) {
      winElement = document.getElementById(WINDOW_ID);
      if (winElement) {
        contentDiv = document.getElementById('process-monitor-content');
        if (contentDiv) {
          winElement.setAttribute('tabindex', '-1');
          winElement.addEventListener('keydown', handleKeyDown);
        }
      }
    }
    return winElement;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!contentDiv || !isOpen) return;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          updateSelectedRow();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < processes.length - 1) {
          selectedIndex++;
          updateSelectedRow();
        }
        break;
      case 'k':
      case 'K':
        e.preventDefault();
        killSelected();
        break;
      case 'q':
      case 'Q':
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  }

  function updateSelectedRow(): void {
    rowElements.forEach((row, idx) => {
      const isSelected = idx === selectedIndex;
      isSelected ? row.classList.add('selected') : row.classList.remove('selected');
      updateRowText(row, processes[idx], isSelected);
    });
  }

  function updateRowText(row: HTMLElement, p: ProcessInfo, isSelected: boolean): void {
    const user = p.elementId ? 'user' : 'system';
    const virt = Math.floor(Math.random() * 200 + 100)
      .toString()
      .padStart(5);
    const res = Math.floor(Math.random() * 50 + 20)
      .toString()
      .padStart(4);
    const shr = Math.floor(Math.random() * 30 + 10)
      .toString()
      .padStart(4);
    const status = p.visible ? 'R' : 'S';
    const selector = isSelected ? '▶' : ' ';
    row.textContent = `${selector} ${p.pid.toString().padStart(5)} ${user.padEnd(8)} 20   0 ${virt} ${res} ${shr} ${status}  ${p.cpu.padStart(4)} ${p.mem.padStart(5)} 0:00.0 ${p.name}`;
  }

  function killSelected(): void {
    if (!processes.length) return;
    const proc = processes[selectedIndex];
    if (!proc.elementId) return;
    const element = document.getElementById(proc.elementId);
    if (!element) return;
    element.style.display = 'none';
    if (window.AudioManager) window.AudioManager.success();
    updateDataAndDisplay();
  }

  function createBar(percentage: number, type: string): HTMLElement {
    const container = document.createElement('span');
    container.className = `${type}-bar-container`;
    const fill = document.createElement('span');
    fill.className = `${type}-bar-fill`;
    fill.style.width = `${percentage}%`;
    container.appendChild(fill);
    return container;
  }

  function renderHeader(): void {
    if (!contentDiv) return;
    const addLine = (text: string): HTMLElement => {
      const line = document.createElement('div');
      line.textContent = text;
      contentDiv!.appendChild(line);
      return line;
    };

    timeLoadLine = addLine('');
    tasksLine = addLine('');
    addLine('Threads: 0');
    addLine('');

    for (let i = 0; i < 4; i++) {
      const line = document.createElement('div');
      line.appendChild(document.createTextNode(`  CPU${i} `));
      line.appendChild(createBar(0, 'cpu'));
      contentDiv.appendChild(line);
    }

    addLine('');
    const memLine = document.createElement('div');
    memLine.appendChild(document.createTextNode('  Memo '));
    const mBar = createBar(0, 'mem');
    memBarFill = mBar.querySelector('.mem-bar-fill');
    memLine.appendChild(mBar);
    memTextSpan = document.createElement('span');
    memLine.appendChild(memTextSpan);
    contentDiv.appendChild(memLine);

    const swapLine = document.createElement('div');
    swapLine.appendChild(document.createTextNode('  Swap '));
    const sBar = createBar(0, 'swap');
    swapBarFill = sBar.querySelector('.swap-bar-fill');
    swapLine.appendChild(sBar);
    swapTextSpan = document.createElement('span');
    swapLine.appendChild(swapTextSpan);
    contentDiv.appendChild(swapLine);

    addLine('');
    addLine('  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND');
  }

  function updateHeader(): void {
    if (!contentDiv || !isOpen) return;

    const now = new Date();
    const load = (Math.random() * 0.5 + 0.05).toFixed(2);
    const memTotal = 7985.5;
    const memUsed = Math.random() * 3000 + 1000;
    const swapTotal = 2048;
    const swapUsed = Math.random() * 500;

    if (timeLoadLine)
      timeLoadLine.textContent = `${now.toLocaleTimeString()} up 1 day, load: ${load}, ${load}, ${load}`;
    if (tasksLine)
      tasksLine.textContent = `Tasks: ${processes.length} total, 1 running, ${processes.length - 1} sleeping`;

    const cpuFills = contentDiv.querySelectorAll('.cpu-bar-fill');
    cpuFills.forEach((fill) => {
      (fill as HTMLElement).style.width = `${Math.random() * 100}%`;
    });

    if (memBarFill) memBarFill.style.width = `${(memUsed / memTotal) * 100}%`;
    if (memTextSpan) memTextSpan.textContent = ` ${memUsed.toFixed(1)}/${memTotal.toFixed(1)} MB`;
    if (swapBarFill) swapBarFill.style.width = `${(swapUsed / swapTotal) * 100}%`;
    if (swapTextSpan)
      swapTextSpan.textContent = ` ${swapUsed.toFixed(1)}/${swapTotal.toFixed(1)} MB`;
  }

  function updateProcessRows(): void {
    if (!contentDiv || !isOpen) return;

    while (rowElements.length < processes.length) {
      const newRow = document.createElement('div');
      contentDiv.appendChild(newRow);
      rowElements.push(newRow);
    }
    while (rowElements.length > processes.length) {
      const lastRow = rowElements.pop();
      if (lastRow) lastRow.remove();
    }

    rowElements.forEach((row, idx) => {
      updateRowText(row, processes[idx], idx === selectedIndex);
    });
  }

  function updateDataAndDisplay(): void {
    if (!isOpen) return;
    const newProcesses = scanProcesses();
    const newJSON = JSON.stringify(newProcesses);

    requestAnimationFrame(() => {
      if (!isOpen) return;
      if (newJSON === lastProcessesJSON) {
        updateHeader();
        return;
      }
      processes = newProcesses;
      lastProcessesJSON = newJSON;
      updateHeader();
      updateProcessRows();
    });
  }

  function open(): void {
    getWindow();
    if (!winElement || !contentDiv) return;

    isOpen = true;
    winElement.style.display = 'block';
    // Don't use local z-index - let focusWindow() handle it with the global z-index manager
    WindowManager.centerWindow(winElement);
    if (window.focusWindow) window.focusWindow(WINDOW_ID);
    if (window.AudioManager) window.AudioManager.windowOpen();

    contentDiv.innerHTML = '';
    rowElements = [];
    renderHeader();
    updateDataAndDisplay();

    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateDataAndDisplay, 2000);
    logger.log(`[ProcessMonitor] Lifecycle started`);
  }

  function close(): void {
    isOpen = false;
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    if (winElement) {
      winElement.style.display = 'none';
      if (window.AudioManager) window.AudioManager.windowClose();
      logger.log(`[ProcessMonitor] Lifecycle stopped`);
    }
  }

  return { open, close };
})();

declare global {
  interface Window {
    ProcessMonitor: typeof ProcessMonitor;
    openTaskManagerInTerminal: () => void;
  }
}

window.ProcessMonitor = ProcessMonitor;
window.openTaskManagerInTerminal = () => ProcessMonitor.open();

export { ProcessMonitor };
