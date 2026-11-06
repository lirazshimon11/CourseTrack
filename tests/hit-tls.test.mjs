import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { createHitFetch, verifiedIntermediateOptions } from '../server/hit-tls.mjs';

const pem=readFileSync(new URL('../server/certificates/letsencrypt-hit-chain.crt',import.meta.url),'utf8');
const duringValidity=Date.parse('2026-11-06T00:00:00Z');
test('bundled public intermediates chain cryptographically to an existing Node root',()=>{
  const options=verifiedIntermediateOptions(pem,rootCertificates,duringValidity);
  assert.equal(options.rejectUnauthorized,true);
  assert.equal(options.allowPartialTrustChain,false);
  assert.equal(options.ca.length,rootCertificates.length+2);
  assert.equal(options.checkServerIdentity,undefined); // Keep Node's default hostname verification.
  assert.throws(()=>verifiedIntermediateOptions(pem,[],duringValidity),/trusted Node root/);
  assert.throws(()=>verifiedIntermediateOptions(pem,rootCertificates,Date.parse('2029-01-01')),/not currently valid/);
  assert.throws(()=>verifiedIntermediateOptions(rootCertificates[0],rootCertificates,duringValidity),/Unexpected/);
  const blocks=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  assert.throws(()=>verifiedIntermediateOptions(blocks.reverse().join('\n'),rootCertificates,duringValidity),/trusted Node root/);
});
test('only missing-chain failures retry, with manual redirects and the verified dispatcher',async()=>{
  const dispatcher={};let fallbacks=0;
  const transport=createHitFetch({primaryFetch:async()=>{throw Object.assign(new Error('TLS'),{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}});},getDispatcher:()=>dispatcher,
    chainFetch:async(url,options)=>{fallbacks++;assert.equal(options.dispatcher,dispatcher);assert.equal(options.redirect,'manual');return new Response('verified');}});
  assert.equal(await (await transport('https://www.hit.ac.il/students/calender/')).text(),'verified');
  assert.equal(fallbacks,1);
});
test('hostname, expiry, self-signed and network errors are not downgraded or retried',async()=>{
  for(const code of ['ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ECONNRESET']) {
    let attempted=false;
    const transport=createHitFetch({primaryFetch:async()=>{throw Object.assign(new Error(code),{cause:{code}});},chainFetch:async()=>{attempted=true;}});
    await assert.rejects(transport('https://www.hit.ac.il/'),new RegExp(code));assert.equal(attempted,false);
  }
});
test('HIT transport cannot be used for other services or insecure URLs',async()=>{
  let calls=0;
  const transport=createHitFetch({primaryFetch:async()=>{calls++;return new Response('ok');}});
  for(const url of ['https://example.supabase.co/','http://hit.ac.il/','https://hit.ac.il.evil.test/','https://user@hit.ac.il/','https://hit.ac.il:8443/']) await assert.rejects(transport(url));
  assert.equal(calls,0);
  await transport('https://hit.ac.il/');assert.equal(calls,1);
});
