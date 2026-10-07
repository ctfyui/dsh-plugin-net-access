import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local';
import z from '@deepseek-ai/schemastery';
import { inspectToolbox, resolveToolBin, toolboxEnvironment } from './environment.js';

/**
 * Official local process implementation with a per-child HTTPS toolbox overlay.
 * Confinement argv, stdio, cancellation, process ownership and credential
 * scrubbing all remain with the DSH provider. This is local-Windows only.
 */
export default class NetAccessSubprocessRuntime extends LocalSubprocessRuntime {
  static Config = z.object({ toolBin: z.string() });

  constructor(ctx, config = {}) {
    if (process.platform !== 'win32') throw new Error('Net Access requires Windows.');
    const toolbox = inspectToolbox(resolveToolBin(config));
    super(ctx);
    this.toolbox = toolbox;
  }

  /** Use the same PATH for executable discovery as for the eventual child. */
  resolveExecutable(command, env, signal) {
    return super.resolveExecutable(command, toolboxEnvironment(env, this.toolbox), signal);
  }

  /** Ordinary commands, background jobs and sandbox runners retain their exact argv. */
  spawn(spec) {
    return super.spawn({ ...spec, env: toolboxEnvironment(spec.env, this.toolbox) });
  }

  /** Persistent terminals receive the toolbox when their process is created. */
  spawnTerminal(spec) {
    return super.spawnTerminal({ ...spec, env: toolboxEnvironment(spec.env, this.toolbox) });
  }
}
