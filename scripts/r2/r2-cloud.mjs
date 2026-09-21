#!/usr/bin/env node
// @ts-nocheck -- CLI JavaScript validado em runtime contra respostas externas da Cloudflare.

/**
 * R2 Cloud Manager — Gerencia o bucket R2 via Cloudflare API
 *
 * Usa a Cloudflare API para listar, fazer upload e deletar arquivos.
 * NENHUM arquivo é baixado para o projeto; tudo fica na cloud.
 *
 * Para escrita, usa a API do Cloudflare com CLOUDFLARE_API_TOKEN.
 *
 * Uso:
 *   node scripts/r2/r2-cloud.mjs list                  # Listar todos os arquivos
 *   node scripts/r2/r2-cloud.mjs list [pasta]           # Listar por pasta
 *   node scripts/r2/r2-cloud.mjs info [arquivo]         # Info de um arquivo
 *   node scripts/r2/r2-cloud.mjs upload <local> <remoto>  # Upload arquivo/pasta
 *   node scripts/r2/r2-cloud.mjs delete <caminho>       # Deletar arquivo
 *   node scripts/r2/r2-cloud.mjs size                   # Tamanho total do bucket
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createR2Client } from './client.mjs';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ──────────────────────────────────────────────────────────────────────────────
// Comandos
// ──────────────────────────────────────────────────────────────────────────────

async function listFiles(prefix = '') {
  console.log(`\n📁 Arquivos em ${prefix || 'raiz'}:`);
  console.log('─'.repeat(80));
  let totalSize = 0;
  let totalCount = 0;
  for await (const obj of createR2Client().list(prefix ? `${prefix.replace(/\/+$/u, '')}/` : '')) {
    const name = obj.key || '';
    const size = obj.size || 0;
    const modTime = obj.last_modified;
    totalSize += size;
    totalCount++;

    const sizeStr = formatSize(size).padStart(12);
    const dateStr = modTime ? new Date(modTime).toLocaleDateString('pt-BR') : '';

    console.log(`📄 ${name.padEnd(50)} ${sizeStr}  ${dateStr}`);
  }

  console.log('─'.repeat(80));
  console.log(`📊 Total: ${totalCount} arquivos, ${formatSize(totalSize)}`);
}

async function fileInfo(path) {
  try {
    const result = await createR2Client().info(path);

    console.log(`\n📄 Informações de ${path}:`);
    console.log('─'.repeat(40));
    console.log(`Nome:      ${result.key || path}`);
    console.log(`Tamanho:   ${formatSize(result.size || 0)}`);
    console.log(`Modificado: ${result.last_modified || 'N/A'}`);
    console.log(`MIME:      ${result.http_metadata?.content_type || 'N/A'}`);
    console.log(`ETag:      ${result.etag || 'N/A'}`);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('404')) {
      console.log(`❌ Arquivo não encontrado: ${path}`);
      process.exit(1);
    }
    throw err;
  }
}

async function uploadFile(localPath, remotePath) {
  if (!existsSync(localPath)) {
    console.error(`❌ Arquivo local não encontrado: ${localPath}`);
    process.exit(1);
  }

  const stat = statSync(localPath);
  const r2 = createR2Client();

  if (stat.isDirectory()) {
    // Upload recursivo de pasta
    console.log(`📁 Sincronizando pasta ${localPath} → ${remotePath}`);

    async function uploadDir(dirPath, prefix) {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await uploadDir(fullPath, key);
        } else {
          await uploadSingleFile(r2, fullPath, key);
        }
      }
    }

    await uploadDir(localPath, remotePath);
  } else {
    await uploadSingleFile(r2, localPath, remotePath);
  }

  console.log('✅ Upload concluído');
}

async function uploadSingleFile(r2, localPath, remotePath) {
  const content = readFileSync(localPath);
  const filename = basename(localPath);

  console.log(`📤 Enviando ${localPath} → ${remotePath}`);

  await r2.put(remotePath, content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength), getMimeType(filename));

  console.log(`   ✅ ${remotePath}`);
}

async function deleteFile(path) {
  console.log(`🗑️  Deletando ${path}`);
  await createR2Client().delete(path);
  console.log('✅ Deletado');
}

async function showSize() {
  let totalSize = 0;
  let totalCount = 0;
  for await (const obj of createR2Client().list()) {
    totalSize += obj.size;
    totalCount++;
  }

  console.log(`\n📊 Tamanho do bucket:`);
  console.log(`   Arquivos: ${totalCount}`);
  console.log(`   Tamanho:  ${formatSize(totalSize)}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'list':
    case 'ls':
      if (args[0]) {
        await listFiles(args[0]);
      } else {
        await listFiles();
      }
      break;

    case 'info':
    case 'stat':
      if (!args[0]) {
        console.error('❌ Uso: r2-cloud.mjs info <caminho>');
        process.exit(1);
      }
      await fileInfo(args[0]);
      break;

    case 'upload':
    case 'cp':
      if (args.length < 2) {
        console.error('❌ Uso: r2-cloud.mjs upload <local> <remoto>');
        process.exit(1);
      }
      await uploadFile(args[0], args[1]);
      break;

    case 'delete':
    case 'rm':
      if (!args[0]) {
        console.error('❌ Uso: r2-cloud.mjs delete <caminho>');
        process.exit(1);
      }
      await deleteFile(args[0]);
      break;

    case 'size':
      await showSize();
      break;

    default:
      console.log(`
🗄️  R2 Cloud Manager

Uso: node scripts/r2/r2-cloud.mjs <comando> [argumentos]

Comandos:
  list [pasta]              Listar arquivos (raiz ou pasta específica)
  info <caminho>            Informações de um arquivo
  upload <local> <remoto>   Upload arquivo ou pasta para R2
  delete <caminho>          Deletar arquivo do R2
  size                      Mostrar tamanho total do bucket

Exemplos:
  node scripts/r2/r2-cloud.mjs list
  node scripts/r2/r2-cloud.mjs list Pictures
  node scripts/r2/r2-cloud.mjs upload ./minha-imagem.png Pictures/nova.png
  node scripts/r2/r2-cloud.mjs delete Pictures/antigo.png
  node scripts/r2/r2-cloud.mjs size

Variáveis de ambiente necessárias no .env:
  CLOUDFLARE_ACCOUNT_ID=     # ID da conta Cloudflare
  CLOUDFLARE_API_TOKEN=      # Token de API com permissões R2
`);
      break;
  }
}

main().catch((err) => {
  console.error(`\n❌ Erro: ${err.message}`);
  process.exit(1);
});
