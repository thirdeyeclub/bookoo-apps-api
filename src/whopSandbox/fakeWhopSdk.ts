import type { Request } from 'express';
import type { WhopSandboxMember, WhopSandboxMembership, WhopSandboxPayment, WhopSandboxProduct, WhopSandboxUser } from './data/models.js';
import { getStore } from './data/store.js';
import { hashSeed } from './data/seed.js';

type VerifyUserTokenResult = { userId: string };

type ProductsListArgs = { company_id: string };
type MembersListArgs = { company_id: string; product_ids?: string[]; statuses?: string[] };
type MembershipsListArgs = { company_id: string; product_ids?: string[]; statuses?: string[] };
type PaymentsListArgs = {
  company_id: string;
  product_ids?: string[];
  statuses?: Array<'paid' | 'refunded'>;
  created_after?: string | null;
  order?: 'paid_at' | 'created_at';
  direction?: 'asc' | 'desc';
  include_free?: boolean;
};

function getSandboxSeed(): string {
  const raw = process.env.WHOP_SANDBOX_SEED;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return 'funneloo';
}

function pickUserIdFromToken(store: ReturnType<typeof getStore>, token: string | null): string {
  if (!token) return store.users[0]?.id || 'usr_000000000001';
  const idx = hashSeed(token) % Math.max(1, store.users.length);
  return store.users[idx]?.id || store.users[0]?.id || 'usr_000000000001';
}

function isLikelyLocalhost(req: Request): boolean {
  const host = (req.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;

  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  const xfHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();

  const hay = `${origin} ${referer} ${xfHost}`;
  return hay.includes('localhost:') || hay.includes('127.0.0.1:');
}

export function shouldUseWhopSandbox(req: Request): boolean {
  return isLikelyLocalhost(req);
}

export function createFakeWhopSdk() {
  const store = getStore(getSandboxSeed());

  function ensureExperience(experienceId: string) {
    const existing = store.experiencesById.get(experienceId);
    if (existing) return existing;
    const companies = store.companies;
    const company =
      companies.length > 0 ? companies[hashSeed(experienceId) % companies.length] : { id: 'biz_000000000001', name: 'Sandbox Company', created_at: new Date().toISOString() };
    const exp = {
      id: experienceId,
      name: `Sandbox Experience ${experienceId}`,
      company: { id: company.id, name: company.name },
      created_at: new Date().toISOString(),
    };
    store.experiences.push(exp as any);
    store.experiencesById.set(experienceId, exp as any);
    return exp as any;
  }

  return {
    async verifyUserToken(token: string): Promise<VerifyUserTokenResult> {
      const userId = pickUserIdFromToken(store, token);
      return { userId };
    },
    users: {
      async retrieve(userId: string): Promise<WhopSandboxUser> {
        const user = store.usersById.get(userId);
        if (!user) throw new Error('User not found');
        return user;
      },
    },
    experiences: {
      async retrieve(experienceId: string) {
        return ensureExperience(experienceId);
      },
    },
    products: {
      async *list(args: ProductsListArgs): AsyncIterable<WhopSandboxProduct> {
        const items = store.products
          .filter((p) => p.company_id === args.company_id)
          .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
        for (const p of items) yield p;
      },
    },
    members: {
      async *list(args: MembersListArgs): AsyncIterable<WhopSandboxMember> {
        const productSet = new Set(args.product_ids || []);
        const statusSet = new Set(args.statuses || []);
        const items = store.members
          .filter((m) => m.company_id === args.company_id)
          .filter((m) => (productSet.size > 0 ? productSet.has(m.product_id) : true))
          .filter((m) => (statusSet.size > 0 ? statusSet.has(m.status) : true))
          .sort((a, b) => ((a.most_recent_action_at || '') > (b.most_recent_action_at || '') ? -1 : 1));
        for (const m of items) yield m;
      },
    },
    memberships: {
      async *list(args: MembershipsListArgs): AsyncIterable<WhopSandboxMembership> {
        const productSet = new Set(args.product_ids || []);
        const statusSet = new Set(args.statuses || []);
        const items = store.memberships
          .filter((m) => m.company_id === args.company_id)
          .filter((m) => (productSet.size > 0 ? productSet.has(m.product_id) : true))
          .filter((m) => (statusSet.size > 0 ? statusSet.has(m.status) : true))
          .sort((a, b) => ((a.ended_at || a.started_at || '') > (b.ended_at || b.started_at || '') ? -1 : 1));
        for (const m of items) yield m;
      },
    },
    payments: {
      async *list(args: PaymentsListArgs): AsyncIterable<WhopSandboxPayment> {
        const productSet = new Set(args.product_ids || []);
        const statusSet = new Set(args.statuses || []);
        const createdAfter = args.created_after ? new Date(args.created_after).toISOString() : null;

        const filtered = store.payments
          .filter((p) => p.company_id === args.company_id)
          .filter((p) => (productSet.size > 0 ? productSet.has(p.product.id) : true))
          .filter((p) => (statusSet.size > 0 ? statusSet.has(p.status) : true))
          .filter((p) => (createdAfter ? p.created_at >= createdAfter : true));

        const orderKey = args.order || 'paid_at';
        const direction = args.direction || 'desc';
        const ordered = [...filtered].sort((a, b) => {
          const av = (a as any)[orderKey] || '';
          const bv = (b as any)[orderKey] || '';
          if (av === bv) return a.id < b.id ? -1 : 1;
          const cmp = av < bv ? -1 : 1;
          return direction === 'asc' ? cmp : -cmp;
        });

        for (const p of ordered) yield p;
      },
    },
  };
}


