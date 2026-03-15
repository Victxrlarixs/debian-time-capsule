import { VFS } from '../../core/vfs';

export class LabShellEngine {
  private aliases: Record<string, string> = {};
  private variables: Record<string, string> = {
    HOME: '/home/victxrlarixs',
    USER: 'victxrlarixs',
    PATH: '/usr/local/bin:/usr/bin:/bin',
    SHELL: '/bin/bash',
  };

  private commandMap: Record<string, (args: string[]) => string | Promise<string>>;

  constructor(
    private getCwd: () => string,
    private setCwd: (path: string) => void,
    private getUser: () => string
  ) {
    this.commandMap = this.buildCommandMap();
  }

  public async execute(raw: string): Promise<string> {
    let processed = this.expandVariables(raw);
    processed = this.expandAliases(processed);

    if (processed.includes('|')) {
      return await this.executePipeline(processed);
    }

    const [cmd, ...argParts] = processed.split(' ');
    let args = argParts.filter(Boolean);
    args = this.expandWildcards(args);

    const handler = this.commandMap[cmd ?? ''];
    if (handler) {
      return await handler(args);
    } else {
      throw new Error(`bash: ${cmd ?? ''}: command not found`);
    }
  }

  private expandVariables(cmd: string): string {
    return cmd.replace(/\$(\w+)/g, (match, varName) => {
      return this.variables[varName] ?? match;
    });
  }

  private expandAliases(cmd: string): string {
    const parts = cmd.split(' ');
    const firstCmd = parts[0];
    if (firstCmd && this.aliases[firstCmd]) {
      parts[0] = this.aliases[firstCmd];
      return parts.join(' ');
    }
    return cmd;
  }

  private expandWildcards(args: string[]): string[] {
    const expanded: string[] = [];
    for (const arg of args) {
      if (arg.includes('*')) {
        const matches = this.matchWildcard(arg);
        if (matches.length > 0) expanded.push(...matches);
        else expanded.push(arg);
      } else {
        expanded.push(arg);
      }
    }
    return expanded;
  }

  private matchWildcard(pattern: string): string[] {
    const node = VFS.getNode(this.getCwd());
    if (!node || node.type !== 'folder') return [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return Object.keys(node.children).filter((name) => regex.test(name));
  }

  private async executePipeline(cmd: string): Promise<string> {
    const commands = cmd.split('|').map((c) => c.trim());
    let output = '';

    for (let i = 0; i < commands.length; i++) {
      const [cmdName, ...argParts] = commands[i].split(' ');
      const args = argParts.filter(Boolean);
      if (i > 0) args.unshift(output);

      const handler = this.commandMap[cmdName ?? ''];
      if (handler) {
        output = await handler(args);
      } else {
        throw new Error(`bash: ${cmdName ?? ''}: command not found`);
      }
    }
    return output;
  }

  public getAvailableCommands(): string[] {
    return Object.keys(this.commandMap);
  }

  private buildCommandMap(): Record<string, (args: string[]) => string | Promise<string>> {
    return {
      pwd: () => this.getCwd(),
      whoami: () => this.getUser(),
      hostname: () => 'debian',
      uname: (a) => a.includes('-a') ? 'Linux debian 5.10.0-20-amd64 #1 SMP Debian x86_64 GNU/Linux' : 'Linux',
      date: () => new Date().toString(),
      echo: (a) => a.join(' '),
      clear: () => '', // Handled by UI
      alias: (args) => {
        if (args.length === 0) {
          return Object.entries(this.aliases).map(([k, v]) => `alias ${k}='${v}'`).join('\n');
        }
        const match = args.join(' ').match(/^(\w+)=['"]?(.+?)['"]?$/);
        if (match) { this.aliases[match[1]] = match[2]; return ''; }
        return 'alias: invalid format. Use: alias name=command';
      },
      unalias: (args) => {
        if (!args[0]) return 'unalias: missing operand';
        delete this.aliases[args[0]];
        return '';
      },
      export: (args) => {
        if (args.length === 0) {
          return Object.entries(this.variables).map(([k, v]) => `export ${k}="${v}"`).join('\n');
        }
        const match = args.join(' ').match(/^(\w+)=['"]?(.+?)['"]?$/);
        if (match) { this.variables[match[1]] = match[2]; return ''; }
        return 'export: invalid format. Use: export VAR=value';
      },
      env: () => Object.entries(this.variables).map(([k, v]) => `${k}=${v}`).join('\n'),
      grep: (args) => {
        if (args.length < 2) return 'grep: missing operand';
        const pattern = args[0];
        const input = args.slice(1).join(' ');
        const regex = new RegExp(pattern, 'i');
        return input.split('\n').filter((line) => regex.test(line)).join('\n');
      },
      head: (args) => {
        const n = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1] || '10') : 10;
        const input = args.filter((a) => a !== '-n' && !a.match(/^\d+$/)).join(' ');
        return input.split('\n').slice(0, n).join('\n');
      },
      tail: (args) => {
        const n = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1] || '10') : 10;
        const input = args.filter((a) => a !== '-n' && !a.match(/^\d+$/)).join(' ');
        const lines = input.split('\n');
        return lines.slice(-n).join('\n');
      },
      wc: (args) => {
        const input = args.join(' ');
        const lines = input.split('\n').length;
        const words = input.split(/\s+/).filter(Boolean).length;
        return `${lines} ${words} ${input.length}`;
      },
      ls: (args) => {
        const showHidden = args.includes('-la') || args.includes('-a');
        const node = VFS.getNode(this.getCwd());
        if (!node || node.type !== 'folder') return 'ls: cannot access directory';
        const children = Object.keys(node.children);
        const base = showHidden ? ['.', '..', ...children] : children;
        return base.join('  ');
      },
      cd: (args) => {
        const target = args[0] ?? '~';
        const resolved = VFS.resolvePath(this.getCwd(), target);
        const node = VFS.getNode(resolved);
        if (!node) return `bash: cd: ${target}: No such file or directory`;
        if (node.type !== 'folder') return `bash: cd: ${target}: Not a directory`;
        this.setCwd(resolved);
        return '';
      },
      cat: (args) => {
        if (!args[0]) return 'cat: missing operand';
        const resolved = VFS.resolvePath(this.getCwd(), args[0]);
        const node = VFS.getNode(resolved);
        if (!node) return `cat: ${args[0]}: No such file or directory`;
        if (node.type !== 'file') return `cat: ${args[0]}: Is a directory`;
        return node.content;
      },
      mkdir: async (args) => {
        if (!args[0]) return 'mkdir: missing operand';
        const resolved = VFS.resolvePath(this.getCwd(), args[0]);
        const parts = resolved.split('/').filter(Boolean);
        const name = parts.pop()!;
        const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
        await VFS.mkdir(parentPath, name);
        return '';
      },
      touch: async (args) => {
        if (!args[0]) return 'touch: missing file operand';
        for (const f of args) {
          const resolved = VFS.resolvePath(this.getCwd(), f);
          const parts = resolved.split('/').filter(Boolean);
          const name = parts.pop()!;
          const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
          await VFS.touch(parentPath, name);
        }
        return '';
      },
      rm: async (args) => {
        if (!args[0]) return 'rm: missing operand';
        const resolved = VFS.resolvePath(this.getCwd(), args[0]);
        const parts = resolved.split('/').filter(Boolean);
        const name = parts.pop()!;
        const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
        return await VFS.rm(parentPath, name) ? '' : `rm: cannot remove '${args[0]}': No such file or directory`;
      },
      help: () => 'Available: ls, cd, pwd, cat, mkdir, touch, rm, echo, clear, whoami, hostname, uname, date, lynx, history, man, alias, export, grep, head, tail, wc. Features: Pipes, Variables, Wildcards.',
      lynx: (args) => {
        if ((window as any).Lynx) { (window as any).Lynx.open(); return args[0] ? `Lynx opened with: ${args[0]}` : 'Lynx opened'; }
        return 'lynx: command not found';
      },
      history: () => 'History feature (limited in Lab).',
      man: (args) => {
        if ((window as any).ManViewer) { (window as any).ManViewer.open(args[0]); return args[0] ? `Opening man: ${args[0]}` : 'Opening man observer...'; }
        return 'man: command not found';
      }
    };
  }
}
