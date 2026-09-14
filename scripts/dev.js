import { spawn } from 'node:child_process';

const isPortTaken = async (port) => {
  return new Promise((resolve) => {
    const check = spawn('bash', ['-lc', `lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1 && echo taken || echo free`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    check.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    check.on('close', () => {
      resolve(output.trim() === 'taken');
    });
  });
};

const killPortProcess = async (port) => {
  const isTaken = await isPortTaken(port);
  if (!isTaken) return;

  const killer = spawn('bash', ['-lc', `lsof -t -iTCP:${port} -sTCP:LISTEN | xargs -r kill -9`], {
    stdio: 'inherit',
  });

  await new Promise((resolve) => {
    killer.on('close', resolve);
  });
};

const start = async () => {
  await killPortProcess(3001);
  await killPortProcess(4173);

  const backend = spawn('npm', ['--prefix', 'backend', 'run', 'dev'], {
    stdio: 'inherit',
    shell: true,
  });

  const frontend = spawn('npm', ['--prefix', 'frontend', 'run', 'dev'], {
    stdio: 'inherit',
    shell: true,
  });

  const shutdown = () => {
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('exit', (code) => {
    if (code !== 0) {
      frontend.kill('SIGTERM');
      process.exit(code ?? 1);
    }
  });

  frontend.on('exit', (code) => {
    backend.kill('SIGTERM');
    process.exit(code ?? 1);
  });
};

start();
