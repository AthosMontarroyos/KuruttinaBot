#!/usr/bin/env node
// @ts-nocheck -- ponte operacional isolada; entradas HTTP e Cloudflare sao validadas em runtime.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bucket = 'kurrutina-bot-pictures';
const apiBase = 'https://api.cloudflare.com/client/v4';
const port = Number(process.env.R2_BRIDGE_PORT ?? 3762);

function loadEnvironment() {
  const environment = { ...process.env };
  const content = readFileSync(resolve(import.meta.dirname, '../..', '.env'), 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && environment[match[1]] === undefined) environment[match[1]] = match[2].trim();
  }
  return environment;
}

const env = loadEnvironment();
const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN sao obrigatorios');

const objectsUrl = `${apiBase}/accounts/${accountId}/r2/buckets/${bucket}/objects`;
const authorization = { Authorization: `Bearer ${apiToken}` };
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');
const decodePath = (url = '/') => decodeURIComponent(new URL(url, 'http://localhost').pathname).replace(/^\/+|\/+$/g, '');
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

async function listObjects() {
  const objects = [];
  let cursor;
  do {
    const url = new URL(objectsUrl);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { headers: authorization });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.errors?.[0]?.message ?? `Cloudflare API ${response.status}`);
    objects.push(...payload.result);
    cursor = payload.result_info?.is_truncated ? payload.result_info.cursor : undefined;
  } while (cursor);
  return objects;
}

function propertyResponse(path, isDirectory, size = 0, modified = new Date()) {
  const href = `/${path ? `${escapeXml(path)}${isDirectory ? '/' : ''}` : ''}`;
  return `<d:response><d:href>${href}</d:href><d:propstat><d:prop>`
    + `<d:resourcetype>${isDirectory ? '<d:collection/>' : ''}</d:resourcetype>`
    + `<d:getcontentlength>${size}</d:getcontentlength>`
    + `<d:getlastmodified>${new Date(modified).toUTCString()}</d:getlastmodified>`
    + `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
}

async function propfind(request, response, path) {
  const objects = await listObjects();
  const prefix = path ? `${path}/` : '';
  const exact = objects.find((object) => object.key === path);
  const descendants = objects.filter((object) => object.key.startsWith(prefix));
  const isDirectory = path === '' || descendants.length > 0;
  if (!isDirectory && !exact) return void response.writeHead(404).end();

  const entries = [propertyResponse(path, isDirectory, exact?.size, exact?.last_modified)];
  if ((request.headers.depth ?? '1') !== '0' && isDirectory) {
    const seenDirectories = new Set();
    for (const object of descendants) {
      const remainder = object.key.slice(prefix.length);
      const separator = remainder.indexOf('/');
      if (separator >= 0) {
        const directory = remainder.slice(0, separator);
        if (!seenDirectories.has(directory)) {
          seenDirectories.add(directory);
          entries.push(propertyResponse(`${prefix}${directory}`, true));
        }
      } else {
        entries.push(propertyResponse(object.key, false, object.size, object.last_modified));
      }
    }
  }

  response.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
  response.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${entries.join('')}</d:multistatus>`);
}

async function objectRequest(path, options = {}) {
  return fetch(`${objectsUrl}/${encodeKey(path)}`, { ...options, headers: { ...authorization, ...options.headers } });
}

async function copyOrMove(request, response, source, removeSource) {
  const destinationHeader = request.headers.destination;
  if (!destinationHeader) return void response.writeHead(400).end();
  const destination = decodePath(destinationHeader);
  const sourceResponse = await objectRequest(source);
  if (!sourceResponse.ok) return void response.writeHead(sourceResponse.status).end();
  const putResponse = await objectRequest(destination, {
    method: 'PUT',
    headers: { 'Content-Type': sourceResponse.headers.get('content-type') ?? 'application/octet-stream' },
    body: sourceResponse.body,
    duplex: 'half',
  });
  if (!putResponse.ok) return void response.writeHead(putResponse.status).end();
  if (removeSource) await objectRequest(source, { method: 'DELETE' });
  response.writeHead(201).end();
}

const server = createServer(async (request, response) => {
  try {
    const path = decodePath(request.url);
    if (request.method === 'OPTIONS') {
      response.writeHead(200, { Allow: 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY', DAV: '1' }).end();
    } else if (request.method === 'PROPFIND') {
      await propfind(request, response, path);
    } else if (request.method === 'GET' || request.method === 'HEAD') {
      const remote = await objectRequest(path, { method: request.method });
      response.writeHead(remote.status, Object.fromEntries(['content-type', 'content-length', 'etag', 'last-modified'].flatMap((name) => {
        const value = remote.headers.get(name);
        return value === null ? [] : [[name, value]];
      })));
      if (request.method === 'HEAD' || !remote.body) response.end();
      else {
        for await (const chunk of remote.body) response.write(chunk);
        response.end();
      }
    } else if (request.method === 'PUT') {
      const remote = await objectRequest(path, {
        method: 'PUT',
        headers: { 'Content-Type': request.headers['content-type'] ?? 'application/octet-stream' },
        body: request,
        duplex: 'half',
      });
      response.writeHead(remote.ok ? 201 : remote.status).end();
    } else if (request.method === 'DELETE') {
      const remote = await objectRequest(path, { method: 'DELETE' });
      response.writeHead(remote.ok ? 204 : remote.status).end();
    } else if (request.method === 'MKCOL') {
      response.writeHead(201).end();
    } else if (request.method === 'MOVE' || request.method === 'COPY') {
      await copyOrMove(request, response, path, request.method === 'MOVE');
    } else {
      response.writeHead(405).end();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (!response.headersSent) response.writeHead(502);
    response.end();
  }
});

server.listen(port, '127.0.0.1', () => console.log(`READY ${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
