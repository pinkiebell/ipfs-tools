#!/usr/bin/env node

import fs from 'fs';
import { ipfsPush } from '../index.js';

async function publishDirectory (dir) {
  if (!dir) {
    throw new Error(`must be invoked with an absolute or relative path to a directory.`);
  }

  console.info(`publishing: ${dir}`);

  const ROOT = '_/';
  const basePath = dir.endsWith('/') ? dir : dir + '/';
  const files = {};
  let todo = fs.readdirSync(basePath).map((e) => basePath + e);

  while (todo.length) {
    const path = todo.pop();

    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      todo = todo.concat(fs.readdirSync(path).map((e) => path + '/' + e));
      continue;
    }

    const hiddenFile = path.indexOf('/.') !== -1;

    if (hiddenFile) {
      console.info(`ignoring: ${path}`);
      continue;
    }

    const key = path.replace(basePath, ROOT);

    console.info(`preparing: ${path} as ${key}`);
    files[key] = fs.readFileSync(path);
  }

  const shouldPin = !!process.env.pin;
  const hashAlgo = process.env.hash || 'sha2-256';
  const url = process.env.url || `https://ipfs.infura.io:5001/api/v0/add?pin=${shouldPin}&cid-version=1&hash=${hashAlgo}`;

  console.info(`Uploading files to ${url}`);
  const ret = await ipfsPush(url, files);
  console.info(ret);

  for (const obj of ret) {
    if (obj.Name === '_') {
      console.info(`root cid: ${obj.Hash}`);
      console.info(`Preview: https://${obj.Hash}.ipfs.infura-ipfs.io/`);
      console.info(`Preview: https://${obj.Hash}.cf-ipfs.com/`);
      console.info(`Example dns entry: _dnslink.example.tld. TXT "dnslink=/ipfs/${obj.Hash}"`);
      break;
    }
  }
}

if (!process.argv[2]) {
  console.error(
    `
    Invoke me with an absolute or relative path to a directory.
    Optional environment variables:
    \tpin: any value to enable pinning
    \thash: hash algorithm
    - OR -
    \turl: override the full ipfs endpoint url
    `
  );
  process.exit(1);
}

publishDirectory(process.argv[2]).catch(console.error);
