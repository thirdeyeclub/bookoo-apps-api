import type {
  WhopSandboxCompany,
  WhopSandboxExperience,
  WhopSandboxMember,
  WhopSandboxPayment,
  WhopSandboxProduct,
  WhopSandboxUser,
} from './models.js';
import { hashSeed, makeRng } from './seed.js';

type Store = {
  seed: string;
  users: WhopSandboxUser[];
  usersById: Map<string, WhopSandboxUser>;
  usersByUsername: Map<string, WhopSandboxUser>;
  companies: WhopSandboxCompany[];
  companiesById: Map<string, WhopSandboxCompany>;
  experiences: WhopSandboxExperience[];
  experiencesById: Map<string, WhopSandboxExperience>;
  products: WhopSandboxProduct[];
  productsById: Map<string, WhopSandboxProduct>;
  members: WhopSandboxMember[];
  membersById: Map<string, WhopSandboxMember>;
  payments: WhopSandboxPayment[];
  paymentsById: Map<string, WhopSandboxPayment>;
};

const cache = new Map<string, Store>();

function isoDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

function id(prefix: string, n: number): string {
  return `${prefix}_${pad(n, 12)}`;
}

function makeUsername(rng: ReturnType<typeof makeRng>, idx: number): string {
  const adjectives = [
    'fast',
    'quiet',
    'bold',
    'bright',
    'lucky',
    'calm',
    'sharp',
    'steady',
    'swift',
    'mellow',
  ] as const;
  const animals = [
    'fox',
    'owl',
    'wolf',
    'lion',
    'panda',
    'otter',
    'eagle',
    'tiger',
    'koala',
    'falcon',
  ] as const;
  return `${rng.pick(adjectives)}_${rng.pick(animals)}_${idx}`;
}

function makeCompanyName(rng: ReturnType<typeof makeRng>, idx: number): string {
  const words = ['Studio', 'Labs', 'Group', 'Works', 'Collective', 'Holdings', 'Systems', 'Network'] as const;
  const prefixes = ['Nova', 'Atlas', 'Orbit', 'Summit', 'Pioneer', 'Vertex', 'Cobalt', 'Cedar'] as const;
  return `${rng.pick(prefixes)} ${words[idx % words.length]}`;
}

function makeProductTitle(rng: ReturnType<typeof makeRng>, idx: number): string {
  const nouns = ['Academy', 'Signals', 'Community', 'Toolkit', 'Blueprint', 'Sprint', 'Masterclass', 'Vault'] as const;
  const modifiers = ['Pro', 'Elite', 'Starter', 'Advanced', 'Ultimate', 'Daily', 'Weekly', 'Prime'] as const;
  return `${rng.pick(modifiers)} ${nouns[idx % nouns.length]}`;
}

function makeRoute(title: string): string {
  return (
    '/' +
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

export function getStore(seed: string): Store {
  const existing = cache.get(seed);
  if (existing) return existing;

  const rng = makeRng(hashSeed(seed));

  const users: WhopSandboxUser[] = [];
  const usersById = new Map<string, WhopSandboxUser>();
  const usersByUsername = new Map<string, WhopSandboxUser>();

  const userCount = 250;
  for (let i = 1; i <= userCount; i++) {
    const user: WhopSandboxUser = {
      id: id('usr', i),
      username: makeUsername(rng, i),
      email: rng.bool(0.95) ? `user${i}@example.com` : null,
      name: rng.bool(0.9) ? `User ${i}` : null,
      profile_picture: rng.bool(0.3) ? `https://picsum.photos/seed/${seed}-user-${i}/200/200` : null,
      created_at: isoDaysAgo(rng.int(30, 900)),
    };
    users.push(user);
    usersById.set(user.id, user);
    usersByUsername.set(user.username, user);
  }

  const companies: WhopSandboxCompany[] = [];
  const companiesById = new Map<string, WhopSandboxCompany>();
  const companyCount = 6;
  for (let i = 1; i <= companyCount; i++) {
    const company: WhopSandboxCompany = {
      id: id('biz', i),
      name: makeCompanyName(rng, i),
      created_at: isoDaysAgo(rng.int(30, 900)),
    };
    companies.push(company);
    companiesById.set(company.id, company);
  }

  const experiences: WhopSandboxExperience[] = [];
  const experiencesById = new Map<string, WhopSandboxExperience>();
  let expCounter = 1;
  for (const c of companies) {
    const count = rng.int(2, 5);
    for (let i = 0; i < count; i++) {
      const exp: WhopSandboxExperience = {
        id: id('exp', expCounter++),
        name: `Experience ${i + 1}`,
        company: { id: c.id, name: c.name },
        created_at: isoDaysAgo(rng.int(10, 600)),
      };
      experiences.push(exp);
      experiencesById.set(exp.id, exp);
    }
  }

  const products: WhopSandboxProduct[] = [];
  const productsById = new Map<string, WhopSandboxProduct>();
  let prodCounter = 1;
  for (const c of companies) {
    const count = rng.int(4, 9);
    for (let i = 0; i < count; i++) {
      const title = makeProductTitle(rng, i + 1);
      const price = rng.pick([0, 999, 1999, 4999, 9999, 14999, 29999] as const);
      const product: WhopSandboxProduct = {
        id: id('prod', prodCounter++),
        company_id: c.id,
        title,
        route: makeRoute(title),
        member_count: 0,
        price,
        created_at: isoDaysAgo(rng.int(5, 500)),
      };
      products.push(product);
      productsById.set(product.id, product);
    }
  }

  const members: WhopSandboxMember[] = [];
  const membersById = new Map<string, WhopSandboxMember>();
  let memCounter = 1;

  const membersPerProductMin = 20;
  const membersPerProductMax = 120;
  const actionKinds = ['login', 'download', 'comment', 'purchase', 'view'] as const;

  for (const p of products) {
    const count = rng.int(membersPerProductMin, membersPerProductMax);
    const used = new Set<string>();
    let joinedCount = 0;

    for (let i = 0; i < count; i++) {
      let user = rng.pick(users);
      let tries = 0;
      while (used.has(user.id) && tries < 10) {
        user = rng.pick(users);
        tries++;
      }
      used.add(user.id);

      const isLeft = rng.bool(0.18);
      const joinedAt = isoDaysAgo(rng.int(1, 240));
      const mostRecentActionAt = isoDaysAgo(rng.int(0, 60));

      const member: WhopSandboxMember = {
        id: id('mem', memCounter++),
        company_id: p.company_id,
        product_id: p.id,
        status: isLeft ? 'left' : 'joined',
        joined_at: joinedAt,
        most_recent_action: rng.pick(actionKinds),
        most_recent_action_at: mostRecentActionAt,
        user,
      };
      members.push(member);
      membersById.set(member.id, member);
      if (!isLeft) joinedCount++;
    }

    p.member_count = joinedCount;
  }

  const payments: WhopSandboxPayment[] = [];
  const paymentsById = new Map<string, WhopSandboxPayment>();
  let payCounter = 1;
  const currencies = ['usd', 'eur', 'gbp'] as const;

  for (const p of products) {
    const purchases = rng.int(30, 240);
    for (let i = 0; i < purchases; i++) {
      const buyer = rng.pick(users);
      const currency = rng.pick(currencies);
      const createdAt = isoDaysAgo(rng.int(1, 240));
      const paidAt = rng.bool(0.97) ? isoDaysAgo(rng.int(0, 240)) : null;
      const refunded = rng.bool(0.07);
      const total = p.price;
      const feeRate = 0.08 + rng.next() * 0.04;
      const afterFees = Math.max(0, Math.round(total * (1 - feeRate)));
      const refundedAmount = refunded ? Math.round(total * (0.5 + rng.next() * 0.5)) : 0;

      const payment: WhopSandboxPayment = {
        id: id('pay', payCounter++),
        company_id: p.company_id,
        created_at: createdAt,
        paid_at: paidAt,
        status: refunded ? 'refunded' : 'paid',
        substatus: refunded ? 'partial' : null,
        currency,
        total,
        amount_after_fees: afterFees,
        refunded_amount: refundedAmount,
        product: { id: p.id, title: p.title },
        user: { id: buyer.id, username: buyer.username, email: buyer.email, name: buyer.name },
      };
      payments.push(payment);
      paymentsById.set(payment.id, payment);
    }
  }

  const store: Store = {
    seed,
    users,
    usersById,
    usersByUsername,
    companies,
    companiesById,
    experiences,
    experiencesById,
    products,
    productsById,
    members,
    membersById,
    payments,
    paymentsById,
  };

  cache.set(seed, store);
  return store;
}


