import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicLookup, isPublicIPv4, publicAgent } from '../server/public-network.mjs';
import { createHitFetch } from '../server/hit-tls.mjs';
import { fetchDocument } from '../server/calendar-fetch.mjs';

test('private, metadata, reserved and IPv6 addresses fail closed', () => {
  for (const ip of ['0.0.0.0','10.1.2.3','127.0.0.1','169.254.169.254','172.16.0.1',
    '172.31.255.255','192.168.1.1','100.64.0.1','198.18.0.1','192.0.2.1',
    '198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','invalid'])
    assert.equal(isPublicIPv4(ip), false, ip);
  assert.equal(isPublicIPv4('8.8.8.8'), true);
});

test('connection lookup rejects mixed DNS answers and propagates resolver errors', async () => {
  const run = (addresses, error = null, all = false) => new Promise((resolve, reject) => {
    createPublicLookup((host, options, cb) => {
      assert.equal(options.family, 4); assert.equal(options.all, true);
      cb(error, addresses.map(address => ({address, family:4})));
    })('university.ac.il', {all}, (err, address) => err ? reject(err) : resolve(address));
  });
  await assert.rejects(run(['8.8.8.8','127.0.0.1']), /not public/);
  await assert.rejects(run([]), /not public/);
  await assert.rejects(run([], new Error('DNS failed')), /DNS failed/);
  assert.equal(await run(['8.8.8.8']), '8.8.8.8');
  assert.deepEqual(await run(['8.8.8.8'], null, true), [{address:'8.8.8.8',family:4}]);
});

test('HIT primary requests cannot override the guarded dispatcher', async () => {
  const transport = createHitFetch({primaryFetch: async (_, options) => {
    assert.equal(options.dispatcher, publicAgent);
    assert.equal(options.redirect, 'manual');
    return new Response('ok');
  }});
  await transport('https://hit.ac.il/', {dispatcher:{},redirect:'follow'});
});

test('redirect to metadata is rejected before a second request', async () => {
  let calls = 0;
  await assert.rejects(fetchDocument('https://example.ac.il/', 100, async () => {
    calls++;
    return new Response(null, {status:302,headers:{location:'http://169.254.169.254/'}});
  }));
  assert.equal(calls, 1);
});
