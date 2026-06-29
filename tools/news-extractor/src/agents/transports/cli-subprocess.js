'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { AgentError } = require('../../core/errors');

/**
 * Transport CLI: invoca un agente como subproceso.
 *
 * Seguridad: spawn(cmd, argsArray, { shell:false }). NUNCA concatena comandos
 * ni interpola input de usuario en una shell. El AgentInput va por stdin (JSON);
 * el AgentOutput se lee de stdout (JSON). stderr se loguea (diagnostico).
 *
 * @param {object} args
 * @param {object} args.manifest  manifiesto del agente (transport.command/args/cwd/timeout_ms)
 * @param {object} args.input     AgentInput (objeto serializable)
 * @param {object} args.ctx       { logger, signal, toolRoot }
 * @returns {Promise<object>} AgentOutput crudo (objeto)
 */
function invokeCliSubprocess({ manifest, input, ctx }) {
  const t = manifest.transport || {};
  const command = t.command;
  const argv = Array.isArray(t.args) ? t.args.slice() : [];
  const timeoutMs = Number(t.timeout_ms) > 0 ? Number(t.timeout_ms) : 60000;
  const cwd = path.resolve(ctx.toolRoot || process.cwd(), t.cwd || '.');
  const logger = ctx.logger;

  if (typeof command !== 'string' || !command) {
    return Promise.reject(
      new AgentError('Manifiesto invalido: transport.command ausente', {
        context: { agentId: manifest.agent && manifest.agent.id },
      }),
    );
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, argv, {
        cwd,
        shell: false, // CRITICO: nunca shell
        env: process.env, // hereda env (claves para el agente IA via process.env)
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(
        new AgentError('No se pudo lanzar el agente (spawn fallo)', {
          context: { command },
          cause: err,
        }),
      );
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    const MAX_OUT = 2 * 1024 * 1024; // 2 MB
    let outLen = 0;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(
        new AgentError(`Timeout del agente (${timeoutMs}ms)`, {
          context: { agentId: manifest.agent && manifest.agent.id, command },
        }),
      );
    }, timeoutMs);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(new AgentError('Agente abortado', { context: { command } }));
    };
    if (ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (d) => {
      outLen += d.length;
      if (outLen <= MAX_OUT) stdoutChunks.push(d);
    });
    child.stderr.on('data', (d) => stderrChunks.push(d));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AgentError('Error ejecutando el agente', { context: { command }, cause: err }));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (stderr && logger) {
        logger.debug('Agente stderr', { agentId: manifest.agent && manifest.agent.id, stderr: stderr.slice(0, 500) });
      }
      if (code !== 0) {
        return reject(
          new AgentError(`Agente salio con codigo ${code}`, {
            context: { command, code, stderr: stderr.slice(0, 300) },
          }),
        );
      }
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      if (!stdout) {
        return reject(new AgentError('Agente no produjo salida en stdout', { context: { command } }));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(
          new AgentError('Salida del agente no es JSON valido', {
            context: { command, preview: stdout.slice(0, 200) },
            cause: err,
          }),
        );
      }
    });

    // Enviar AgentInput por stdin y cerrar.
    try {
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(new AgentError('No se pudo escribir stdin al agente', { context: { command }, cause: err }));
      }
    }
  });
}

module.exports = { invokeCliSubprocess, type: 'cli' };
