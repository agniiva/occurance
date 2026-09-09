'use strict';

// Run without dependencies: node --test tests/channel_sound_storage.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../static/js/channel.js'), 'utf8');
const soundKey = 'agniva:channel-sound';

function loadChannel(failure, initial = '1') {
  const listeners = {};
  const attributes = new Map();
  const stored = new Map([[soundKey, initial]]);
  let playCalls = 0;
  let pauseCalls = 0;
  class Element {
    hasAttribute() { return false; }
    closest() { return this; }
  }
  const anchor = new Element();
  anchor.href = 'https://example.test/about/';
  const button = {
    hidden: true,
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, listener) => { listeners[`button:${name}`] = listener; },
  };
  const root = {
    hasAttribute: () => false,
    toggleAttribute() {},
    classList: { add() {}, remove() {} },
  };
  const storage = {
    getItem(key) {
      if (failure === 'read') throw new Error('Storage reads blocked');
      return stored.get(key) ?? null;
    },
    setItem(key, value) {
      if (failure === 'write') throw new Error('Storage writes blocked');
      stored.set(key, value);
    },
    removeItem: key => stored.delete(key),
  };
  const window = {
    get localStorage() {
      if (failure === 'access') throw new Error('Storage access blocked');
      return storage;
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener: (name, listener) => { listeners[name] = listener; },
  };
  runInNewContext(source, {
    window, Element, URL,
    document: {
      documentElement: root,
      currentScript: { src: 'https://example.test/js/channel.js' },
      querySelector: selector => selector === '#channel-sound' ? button : null,
      addEventListener: (name, listener) => { listeners[name] = listener; },
    },
    location: new URL('https://example.test/'),
    matchMedia: () => ({ matches: false }),
    Audio: class {
      play() { playCalls++; return Promise.resolve(); }
      pause() { pauseCalls++; }
    },
    // Do not navigate away: exercise the real click and BFCache handlers.
    setTimeout() {}, clearTimeout() {}, scrollY: 0, innerHeight: 1000,
  });
  listeners.DOMContentLoaded();
  return {
    stored,
    toggle: () => listeners['button:click'](),
    restore: () => listeners.pageshow({ persisted: true }),
    navigate: () => listeners.click({
      button: 0, target: anchor, isTrusted: true, preventDefault() {},
    }),
    snapshot: () => ({
      label: button.textContent,
      pressed: attributes.get('aria-pressed'),
      hidden: button.hidden,
      playCalls,
      pauseCalls,
    }),
  };
}

for (const failure of ['access', 'read', 'write']) {
  test(`mute survives ${failure} failure and BFCache restoration`, () => {
    const channel = loadChannel(failure);
    assert.equal(channel.snapshot().playCalls, 0, 'No autoplay');
    channel.navigate();
    assert.equal(channel.snapshot().playCalls, 1, 'Enabled trusted navigation plays');
    channel.restore();
    channel.toggle();
    channel.navigate();
    const afterMute = channel.snapshot();
    channel.restore();
    channel.navigate();
    const afterRestore = channel.snapshot();
    const muted = {
      label: 'Sound off', pressed: 'false', hidden: false, playCalls: 1, pauseCalls: 1,
    };
    assert.deepEqual({ afterMute, afterRestore }, { afterMute: muted, afterRestore: muted });
    channel.restore();
    channel.toggle();
    channel.navigate();
    assert.equal(channel.snapshot().label, 'Sound on');
    assert.equal(channel.snapshot().pressed, 'true');
    assert.equal(channel.snapshot().playCalls, 2, 'Unmute works without storage');
  });
}

test('stored mute initializes the control and available storage syncs on BFCache restore', () => {
  const channel = loadChannel(null, '0');
  assert.equal(channel.snapshot().label, 'Sound off');
  assert.equal(channel.snapshot().pressed, 'false');
  channel.navigate();
  assert.equal(channel.snapshot().playCalls, 0);
  channel.stored.set(soundKey, '1');
  channel.restore();
  assert.equal(channel.snapshot().label, 'Sound on');
  channel.navigate();
  assert.equal(channel.snapshot().playCalls, 1);
  channel.toggle();
  assert.equal(channel.stored.get(soundKey), '0', 'Mute remains persisted when possible');
});
