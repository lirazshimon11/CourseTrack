import { lookup } from 'node:dns';
import { isIPv4 } from 'node:net';
import { Agent } from 'undici';

export function isPublicIPv4(address) {
  if (!isIPv4(address)) return false;
  const [a, b, c] = address.split('.').map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 &&
    !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113);
}

// Validate the actual connection lookup, not a separate preflight DNS request.
// Reject mixed answers as well as private-only answers; IPv6 fails closed.
export function createPublicLookup(resolve = lookup) {
  return (hostname, options, callback) => {
    resolve(hostname, { ...options, family: 4, all: true }, (error, addresses) => {
      if (error) return callback(error);
      if (!addresses?.length || !addresses.every(({ address }) => isPublicIPv4(address)))
        return callback(new Error('Source address is not public'));
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, 4);
    });
  };
}

export const publicLookup = createPublicLookup();
export const publicAgent = new Agent({ connect: { lookup: publicLookup } });
