import compiled from '../server/compiled/affiliateApi.cjs';
// Vercel loads compiled Node code; keep TypeScript/frontend resolution out of runtime.
export default (compiled as any).default || compiled;
