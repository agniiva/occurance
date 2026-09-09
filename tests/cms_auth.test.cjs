'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const auth = require('../api/auth.js');
const callback = require('../api/callback.js');

const ORIGIN = 'https://www.agnivamahata.com';
const REDIRECT = ORIGIN + '/api/callback';
const STATE = 'a'.repeat(64);
const COOKIE = 'cms_oauth_state';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(status, headers) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    },
    end(body = '') { this.body = body; },
  };
}

function setup(t, provider = { access_token: 'test-token' }) {
  const previous = {
    id: process.env.GITHUB_OAUTH_CLIENT_ID,
    secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    fetch: global.fetch,
  };
  process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-secret';
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return { ok: true, status: 200, text: async () => JSON.stringify(provider) };
  };
  t.after(() => {
    for (const [key, value] of [
      ['GITHUB_OAUTH_CLIENT_ID', previous.id],
      ['GITHUB_OAUTH_CLIENT_SECRET', previous.secret],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    global.fetch = previous.fetch;
  });
  return calls;
}

function request(query = { code: 'test-code', state: STATE }, cookie = COOKIE + '=' + STATE) {
  return { query, headers: { cookie } };
}

function noCache(res) {
  assert.match(res.headers['cache-control'] || '', /no-store/);
}

function clearedCookie(res) {
  assert.match(res.headers['set-cookie'] || '', /^cms_oauth_state=;/);
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/api', 'Max-Age=0']) {
    assert.ok(res.headers['set-cookie'].includes(flag), flag);
  }
}

test('authorization binds a random secure cookie to the canonical GitHub redirect', (t) => {
  const calls = setup(t);
  const states = new Set();
  for (let i = 0; i < 4; i++) {
    const res = response();
    auth({ query: {}, headers: { host: 'evil.example' } }, res);
    assert.equal(res.statusCode, 302);
    noCache(res);
    const url = new URL(res.headers.location);
    assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(url.searchParams.get('client_id'), 'test-client');
    assert.equal(url.searchParams.get('redirect_uri'), REDIRECT);
    assert.ok(url.searchParams.get('scope').split(/[ ,]+/).includes('repo'));
    const state = url.searchParams.get('state');
    assert.match(state || '', /^[a-f0-9]{64}$/);
    assert.ok(res.headers['set-cookie'].startsWith(COOKIE + '=' + state + ';'));
    for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/api', 'Max-Age=600']) {
      assert.ok(res.headers['set-cookie'].includes(flag), flag);
    }
    assert.ok(!res.headers['set-cookie'].includes('Domain='));
    states.add(state);
  }
  assert.equal(states.size, 4);
  assert.equal(calls.length, 0);
});

test('callback rejects missing, mismatched, duplicated or malformed state/code before exchange', async (t) => {
  const calls = setup(t);
  const invalid = [
    request({ code: 'test-code' }),
    request({ code: 'test-code', state: 'b'.repeat(64) }),
    request(undefined, ''),
    request(undefined, COOKIE + '=' + STATE + '; ' + COOKIE + '=' + STATE),
    request(undefined, COOKIE + '=%ZZ'),
    request(undefined, COOKIE + '=' + STATE.toUpperCase()),
    request(undefined, [COOKIE + '=' + STATE]),
    request({ code: 'test-code', state: [STATE, STATE] }),
    request({ code: 'test-code', state: { value: STATE } }),
    request({ code: 'test-code', state: STATE + '\n' }),
    request({ code: 'test-code', state: 'a'.repeat(10000) }),
    request({ state: STATE }),
    ...['', ['test-code'], {}, 42, 'a b', 'code\n', '<script>', 'a'.repeat(513)].map(
      code => request({ code, state: STATE })
    ),
    { headers: {} },
    request({ code: 'test-code', state: STATE, error: 'access_denied' }),
  ];
  for (const req of invalid) {
    const res = response();
    await callback(req, res);
    assert.equal(res.statusCode, 400, JSON.stringify(req));
    assert.match(res.body, /restart|try again/i);
    noCache(res);
    clearedCookie(res);
  }
  assert.equal(calls.length, 0);
});

function popup(html, hasOpener = true) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'callback contains an inline handshake script');
  const messages = [];
  const listeners = new Set();
  const opener = { postMessage: (data, origin) => messages.push({ data, origin }) };
  const window = {
    opener: hasOpener ? opener : null,
    addEventListener(type, listener) {
      assert.equal(type, 'message');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'message');
      listeners.delete(listener);
    },
  };
  vm.runInNewContext(script[1], { window });
  return {
    messages, opener,
    emit(event) { for (const listener of [...listeners]) listener(event); },
  };
}

test('successful exchange delivers safely encoded tokens only to the canonical opener handshake', async (t) => {
  const token = 'test-token\'"\\\n</script><script>throw new Error("injected")</script>\u2028\u2029';
  const calls = setup(t, { access_token: token });
  const res = response();
  await callback(request(undefined, 'unrelated=1; ' + COOKIE + '=' + STATE + '; other=2'), res);
  assert.equal(res.statusCode, 200);
  noCache(res);
  clearedCookie(res);
  assert.match(res.headers['content-type'], /^text\/html; charset=utf-8$/);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://github.com/login/oauth/access_token');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(options.body), {
    client_id: 'test-client', client_secret: 'test-secret', code: 'test-code', redirect_uri: REDIRECT,
  });
  assert.equal((res.body.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(res.body, /test-secret/);
  const page = popup(res.body);
  assert.deepEqual(page.messages, [{ data: 'authorizing:github', origin: ORIGIN }]);
  const valid = { data: 'authorizing:github', source: page.opener, origin: ORIGIN };
  for (const event of [
    { ...valid, origin: 'https://evil.example' },
    { ...valid, origin: 'https://agnivamahata.com' },
    { ...valid, origin: 'null' },
    { ...valid, source: {} },
    { ...valid, source: null },
    ...['authorizing:gitlab', 'authorization:github', '', {}, null].map(data => ({ ...valid, data })),
  ]) page.emit(event);
  assert.equal(page.messages.length, 1, 'untrusted messages must not receive a token');
  page.emit(valid);
  assert.equal(page.messages.length, 2);
  assert.equal(page.messages[1].origin, ORIGIN);
  const prefix = 'authorization:github:success:';
  assert.ok(page.messages[1].data.startsWith(prefix));
  assert.deepEqual(JSON.parse(page.messages[1].data.slice(prefix.length)), { token, provider: 'github' });
  page.emit(valid);
  assert.equal(page.messages.length, 2, 'send the credential once');
  assert.equal(popup(res.body, false).messages.length, 0, 'no opener must not throw');
});

test('provider failures return the same actionable error without exposing or logging details', async (t) => {
  setup(t);
  const logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    t.mock.method(console, method, (...args) => logged.push(args));
  }
  const detail = 'private-provider-body test-secret test-token';
  const failures = [
    { name: 'HTTP failure even with a token', ok: false, body: { access_token: detail } },
    { name: 'OAuth rejection', body: { error: 'bad_verification_code', error_description: detail } },
    { name: 'non-JSON response', raw: '<html>' + detail + '</html>' },
    { name: 'missing token', body: { unexpected: detail } },
    ...[null, [], 42, 'unexpected'].map(body => ({ name: 'invalid response shape', body })),
    ...['', '  ', null, {}, [], 42].map(access_token => ({ name: 'invalid token', body: { access_token } })),
    { name: 'network failure', reject: true },
    { name: 'body read failure', readReject: true },
  ];
  let message;
  for (const failure of failures) {
    global.fetch = async () => {
      if (failure.reject) throw new Error(detail);
      return {
        ok: failure.ok !== false,
        status: failure.ok === false ? 503 : 200,
        text: async () => {
          if (failure.readReject) throw new Error(detail);
          return failure.raw === undefined ? JSON.stringify(failure.body) : failure.raw;
        },
      };
    };
    const res = response();
    await callback(request(), res);
    assert.equal(res.statusCode, 502, failure.name);
    assert.match(res.body, /restart|try again/i);
    assert.doesNotMatch(res.body, /private-provider-body|test-secret|test-token|bad_verification_code|<script>/);
    if (message === undefined) message = res.body;
    assert.equal(res.body, message, 'provider details must not change the public response');
    noCache(res);
    clearedCookie(res);
  }
  assert.deepEqual(logged, []);
});

test('both endpoints fail closed on missing configuration without revealing credentials', async (t) => {
  const calls = setup(t);
  for (const key of ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET']) {
    const value = process.env[key];
    for (const missing of [undefined, '', '  ']) {
      if (missing === undefined) delete process.env[key];
      else process.env[key] = missing;
      for (const handler of [auth, callback]) {
        const res = response();
        await handler(request(), res);
        assert.equal(res.statusCode, 500);
        assert.match(res.body, /contact.*administrator/i);
        assert.doesNotMatch(res.body, /test-secret|test-client|clientId|GITHUB_OAUTH|secret=/);
        assert.equal(res.headers.location, undefined);
        noCache(res);
        clearedCookie(res);
      }
    }
    process.env[key] = value;
  }
  assert.equal(calls.length, 0);
});
