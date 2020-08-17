
async function createFetchJson (url, headers) {
  const method = 'POST';

  if (typeof fetch !== 'undefined') {
    // browser
    return async function (payload) {
      const resp = await fetch(url, { body: Uint8Array.from(payload), method, headers });
      const str = await resp.text();

      if (resp.status !== 200) {
        throw new Error(str);
      }

      return str;
    };
  }

  // nodejs
  {
    const http = await import('http');
    const https = await import('https');
    const { parse } = await import('url');
    const fetchOptions = parse(url);
    const proto = fetchOptions.protocol === 'http:' ? http : https;

    fetchOptions.method = method;
    fetchOptions.headers = headers;

    return async function (payload) {
      return new Promise(
        function (resolve, reject) {
          const req = proto.request(fetchOptions);
          let body = '';

          req.on('error', reject);
          req.on('response', function (resp) {
            resp.on('data', function (buf) {
              body += buf.toString();
            });
            resp.on('end', function () {
              if (resp.statusCode !== 200) {
                return reject(body);
              }

              resolve(body);
            });
          });

          req.end(Buffer.from(payload));
        }
      );
    };
  }
}

let _fetch;

export async function ipfsPush (url, files) {
  const boundary = 'x';

  if (!_fetch) {
    const headers = {
      'content-type': 'multipart/form-data; boundary=' + boundary,
    };
    _fetch = await createFetchJson(url, headers);
  }

  const coder = new TextEncoder();
  let data = [];

  for (const f in files) {
    const payload = files[f];
    const filename = encodeURIComponent(f);
    const str = `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: application/octet-stream\r\n\r\n`;
    const head = Array.from(coder.encode(str));
    const tail = Array.from(coder.encode('\r\n'));

    data = data.concat(head).concat(Array.from(payload)).concat(tail);
  }

  data = data.concat(Array.from(coder.encode('--' + boundary + '--\r\n')));

  const ret = await _fetch(data);
  return ret.split('\n').slice(0, -1).map((str) => JSON.parse(str));
}
