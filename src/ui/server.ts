import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { UI_CSS, UI_HTML, UI_JS } from './assets.js';
import { loadOverviewPayload, type OverviewPayload } from './view-models.js';
import { openDatabase } from '../database/db.js';

type UiServerOptions = {
  port?: number;
  budgetLimitUsd?: number | null;
  openBrowser?: boolean;
  loadOverview?: () => OverviewPayload;
};

type StartedUiServer = {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
};

export async function startUiServer(options: UiServerOptions = {}): Promise<StartedUiServer> {
  const loadOverview = options.loadOverview ?? (() => {
    const db = openDatabase();
    try {
      return loadOverviewPayload(db, {
        budgetLimitUsd: options.budgetLimitUsd ?? null,
      });
    } finally {
      db.close();
    }
  });

  let chosenPort = options.port ?? 4310;
  let server: Server | null = null;

  while (!server) {
    try {
      server = await listen(createUiServer(loadOverview), chosenPort);
    } catch (error) {
      if (isAddressInUseError(error)) {
        chosenPort += 1;
        continue;
      }
      throw error;
    }
  }

  const url = `http://localhost:${chosenPort}`;
  if (options.openBrowser) {
    openUrl(url);
  }

  return {
    server,
    port: chosenPort,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

export function createUiServer(loadOverview: () => OverviewPayload): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, loadOverview);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  loadOverview: () => OverviewPayload,
): Promise<void> {
  const url = request.url ?? '/';

  if (url === '/' || url === '/index.html') {
    sendText(response, 200, 'text/html; charset=utf-8', UI_HTML);
    return;
  }

  if (url === '/styles.css') {
    sendText(response, 200, 'text/css; charset=utf-8', UI_CSS);
    return;
  }

  if (url === '/app.js') {
    sendText(response, 200, 'application/javascript; charset=utf-8', UI_JS);
    return;
  }

  if (url === '/api/overview') {
    try {
      const payload = loadOverview();
      sendJson(response, 200, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown overview failure';
      sendJson(response, 500, {
        error: {
          message: `Failed to load overview data: ${message}`,
        },
      });
    }
    return;
  }

  sendText(response, 404, 'text/plain; charset=utf-8', 'Not found');
}

function sendText(response: ServerResponse, statusCode: number, contentType: string, body: string): void {
  response.writeHead(statusCode, { 'Content-Type': contentType });
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function listen(server: Server, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function isAddressInUseError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EADDRINUSE');
}

function openUrl(url: string): void {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

export type { StartedUiServer, UiServerOptions };
