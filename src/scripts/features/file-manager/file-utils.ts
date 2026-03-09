import { VFS, type VFSNode } from '../../core/vfs';
import { CDEModal } from '../../ui/modals';

/**
 * Formats bytes to human-readable size (B, KB, MB, GB).
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Returns appropriate icon path based on file type and content.
 */
export function getFileIcon(node: VFSNode, fullPath?: string): string {
  if (node.type === 'folder') {
    return '/icons/apps/filemanager.png';
  }

  const fileNode = node as any;
  const isEmpty = !fileNode.content || fileNode.content.trim() === '';
  return isEmpty ? '/icons/mimetypes/document.png' : '/icons/mimetypes/gtk-file.png';
}

/**
 * Displays file/folder properties modal with size, date, permissions.
 */
export async function showProperties(fullPath: string): Promise<void> {
  const node = VFS.getNode(
    fullPath + (VFS.getNode(fullPath + '/') && !fullPath.endsWith('/') ? '/' : '')
  );
  if (!node) return;

  const parts = fullPath.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || '/';
  const meta = (node as any).metadata;
  const size = VFS.getSize(fullPath + (node.type === 'folder' ? '/' : ''));
  const sizeStr = formatSize(size);
  const dateStr = meta?.mtime ? new Date(meta.mtime).toLocaleString() : 'Unknown';

  let itemCount = '';
  if (node.type === 'folder') {
    const children = VFS.getChildren(fullPath + '/');
    const count = children ? Object.keys(children).length : 0;
    itemCount = `<tr><td style="padding: 2px 0; color: #555;">Items:</td><td>${count}</td></tr>`;
  }

  const html = `
    <div class="fm-properties">
      <div style="display: flex; gap: 15px; margin-bottom: 10px;">
        <img src="${getFileIcon(node)}" style="width: 48px; height: 48px;" />
        <div>
          <b style="font-size: 14px;">${name}</b><br/>
          <span style="color: #666;">Type: ${node.type}</span>
        </div>
      </div>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;"/>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <tr><td style="padding: 2px 0; color: #555;">Path:</td><td>${fullPath}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Size:</td><td>${sizeStr}</td></tr>
        ${itemCount}
        <tr><td style="padding: 2px 0; color: #555;">Modified:</td><td>${dateStr}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Owner:</td><td>${meta?.owner || 'victx'}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Permissions:</td><td><code>${meta?.permissions || (node.type === 'folder' ? 'rwxr-xr-x' : 'rw-r--r--')}</code></td></tr>
      </table>
    </div>
  `;

  CDEModal.open(`Properties: ${name}`, html, [{ label: 'Close', value: true, isDefault: true }]);
}
