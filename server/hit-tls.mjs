import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { Agent, fetch as undiciFetch } from 'undici';
import { publicAgent, publicLookup } from './public-network.mjs';

const missingChainErrors = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']);
let dispatcher;

// Intermediates must chain to an EXISTING Node root. Never trust a certificate
// obtained from the failing peer or add a new self-signed trust anchor.
export function verifiedIntermediateOptions(pem, roots = rootCertificates, now = Date.now()) {
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (blocks.length !== 2) throw new Error('Unexpected HIT intermediate certificate bundle');
  const [issuer, crossSigned] = blocks.map(c => new X509Certificate(c));
  for (const cert of [issuer, crossSigned]) {
    if (!cert.ca || now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo))
      throw new Error('HIT intermediate certificate bundle is not currently valid');
  }
  const trustedRoot = roots.map(c => new X509Certificate(c)).find(c =>
    crossSigned.checkIssued(c) && crossSigned.verify(c.publicKey));
  if (!trustedRoot || !issuer.checkIssued(crossSigned) || !issuer.verify(crossSigned.publicKey))
    throw new Error('HIT intermediate bundle does not chain to a trusted Node root');
  return { ca: [...roots, ...blocks], rejectUnauthorized: true, allowPartialTrustChain: false };
}

function hitDispatcher() {
  if (!dispatcher) {
    const bundle = readFileSync(new URL('./certificates/letsencrypt-hit-chain.crt', import.meta.url), 'utf8');
    dispatcher = new Agent({ connect: { ...verifiedIntermediateOptions(bundle), lookup: publicLookup } });
  }
  return dispatcher;
}

export function createHitFetch({ primaryFetch = undiciFetch, chainFetch = undiciFetch, getDispatcher = hitDispatcher } = {}) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['www.hit.ac.il','hit.ac.il'].includes(parsed.hostname) || parsed.port || parsed.username || parsed.password)
      throw new Error('HIT TLS transport only accepts the approved HIT HTTPS origin');
    const requestOptions = { ...options, redirect: 'manual', dispatcher: publicAgent };
    try { return await primaryFetch(url, requestOptions); }
    catch (error) {
      if (!missingChainErrors.has(error.cause?.code ?? error.code)) throw error;
      // Second connection is still fully verified: hostname, expiry and root.
      // No global TLS settings are changed; this transport is restricted to HIT.
      return chainFetch(url, { ...requestOptions, dispatcher: getDispatcher() });
    }
  };
}

export const fetchHit = createHitFetch();
