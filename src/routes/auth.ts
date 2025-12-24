import { Router } from 'express';
import Whop from '@whop/sdk';

const router = Router();

const sdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || '',
  appID: process.env.WHOP_APP_ID || '',
});

function parseCsv(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => parseCsv(v));
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseRangeDays(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '' || v === 'all' || v === '0') return null;
    const n = Number(v);
    if (n === 7 || n === 30) return n;
    return null;
  }
  if (typeof value === 'number') {
    if (value === 7 || value === 30) return value;
    return null;
  }
  return null;
}

router.get('/user', async (req, res) => {
  try {
    const userToken = req.headers['x-whop-user-token'] as string;

    if (!userToken) {
      return res.status(401).json({ 
        error: 'No user token found',
        dev_mode: true 
      });
    }

    const verifiedUser = await sdk.verifyUserToken(userToken);
    const userId = verifiedUser.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid user token' });
    }

    const user = await sdk.users.retrieve(userId);

    res.json({
      userId: user.id,
      username: user.username,
      email: (user as any).email || null,
      profilePictureUrl: user.profile_picture || null,
    });
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message || 'Authentication failed' });
  }
});

router.get('/experience/:experienceId', async (req, res) => {
  try {
    const { experienceId } = req.params;
    const userToken = req.headers['x-whop-user-token'] as string;

    if (!userToken) {
      return res.status(401).json({ 
        error: 'No user token found',
        dev_mode: true 
      });
    }

    const verifiedUser = await sdk.verifyUserToken(userToken);
    const userId = verifiedUser.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid user token' });
    }

    const experience = await sdk.experiences.retrieve(experienceId);
    const companyId = experience.company.id;

    res.json({
      userId,
      experienceId,
      companyId,
    });
  } catch (err: any) {
    console.error('Experience auth error:', err);
    res.status(500).json({ error: err.message || 'Experience fetch failed' });
  }
});

router.get('/products/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const fetchedProducts = [];
    for await (const product of sdk.products.list({ company_id: companyId })) {
      fetchedProducts.push({
        id: product.id,
        title: product.title,
        member_count: product.member_count,
        route: product.route,
        price: (product as any).price || 0,
      });
    }

    res.json({ products: fetchedProducts });
  } catch (err: any) {
    console.error('Products fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch products' });
  }
});

router.get('/revenue/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const productIds = parseCsv(req.query.product_ids || req.query.productIds);
    if (productIds.length === 0) {
      return res.status(400).json({ error: 'product_ids is required' });
    }

    const rangeDays = parseRangeDays(req.query.range_days ?? req.query.rangeDays);
    const since =
      rangeDays && Number.isFinite(rangeDays)
        ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const payments: Array<{
      id: string;
      paid_at: string | null;
      created_at: string;
      status: any;
      substatus: any;
      currency: any;
      product: { id: string; title: string | null } | null;
      user: { id: string; username: string | null; email: string | null; name: string | null } | null;
      gross: number;
      net_after_fees: number;
      refunded: number;
      net: number;
    }> = [];

    const totalsByCurrency: Record<
      string,
      { gross: number; net_after_fees: number; refunded: number; net: number; count: number }
    > = {};

    const byProduct: Record<
      string,
      {
        product_id: string;
        product_title: string | null;
        totals_by_currency: Record<
          string,
          { gross: number; net_after_fees: number; refunded: number; net: number; count: number }
        >;
      }
    > = {};

    for await (const p of sdk.payments.list({
      company_id: companyId,
      product_ids: productIds,
      statuses: ['paid'] as any,
      created_after: since,
      order: 'paid_at',
      direction: 'desc',
      include_free: false,
    } as any)) {
      const currency = (p as any).currency || 'unknown';
      const currencyKey = typeof currency === 'string' ? currency : String(currency);
      const productId = (p as any).product?.id as string | undefined;
      const productTitle = ((p as any).product?.title as string | undefined) ?? null;

      const gross = typeof (p as any).total === 'number' ? (p as any).total : 0;
      const netAfterFees = typeof (p as any).amount_after_fees === 'number' ? (p as any).amount_after_fees : 0;
      const refunded = typeof (p as any).refunded_amount === 'number' ? (p as any).refunded_amount : 0;
      const net = netAfterFees - refunded;

      if (!totalsByCurrency[currencyKey]) {
        totalsByCurrency[currencyKey] = { gross: 0, net_after_fees: 0, refunded: 0, net: 0, count: 0 };
      }
      totalsByCurrency[currencyKey].gross += gross;
      totalsByCurrency[currencyKey].net_after_fees += netAfterFees;
      totalsByCurrency[currencyKey].refunded += refunded;
      totalsByCurrency[currencyKey].net += net;
      totalsByCurrency[currencyKey].count += 1;

      if (productId) {
        if (!byProduct[productId]) {
          byProduct[productId] = { product_id: productId, product_title: productTitle, totals_by_currency: {} };
        }
        if (!byProduct[productId].totals_by_currency[currencyKey]) {
          byProduct[productId].totals_by_currency[currencyKey] = {
            gross: 0,
            net_after_fees: 0,
            refunded: 0,
            net: 0,
            count: 0,
          };
        }
        byProduct[productId].totals_by_currency[currencyKey].gross += gross;
        byProduct[productId].totals_by_currency[currencyKey].net_after_fees += netAfterFees;
        byProduct[productId].totals_by_currency[currencyKey].refunded += refunded;
        byProduct[productId].totals_by_currency[currencyKey].net += net;
        byProduct[productId].totals_by_currency[currencyKey].count += 1;
      }

      payments.push({
        id: (p as any).id,
        paid_at: (p as any).paid_at || null,
        created_at: (p as any).created_at,
        status: (p as any).status,
        substatus: (p as any).substatus,
        currency: (p as any).currency,
        product: (p as any).product ? { id: (p as any).product.id, title: (p as any).product.title ?? null } : null,
        user: (p as any).user
          ? {
              id: (p as any).user.id,
              username: (p as any).user.username ?? null,
              email: (p as any).user.email ?? null,
              name: (p as any).user.name ?? null,
            }
          : null,
        gross,
        net_after_fees: netAfterFees,
        refunded,
        net,
      });
    }

    const products = productIds.map((pid) => byProduct[pid]).filter(Boolean);

    res.json({
      companyId,
      productIds,
      rangeDays: rangeDays ?? 'all',
      since,
      totalsByCurrency,
      products,
      payments,
    });
  } catch (err: any) {
    console.error('Revenue fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch revenue' });
  }
});

router.get('/members/:companyId/:productId', async (req, res) => {
  try {
    const { companyId, productId } = req.params;

    const owners = [];
    const statuses = parseCsv(req.query.statuses);
    const statusFilter = statuses.length > 0 ? statuses : ['joined'];
    for await (const member of sdk.members.list({
      company_id: companyId,
      product_ids: [productId],
      statuses: statusFilter
    } as any)) {
      if (member.user) {
        const leftAt =
          member.status === 'left'
            ? (member.most_recent_action_at || null)
            : null;
        owners.push({
          id: member.user.id,
          username: member.user.username || undefined,
          email: member.user.email || undefined,
          name: member.user.name || undefined,
          joinedAt: member.joined_at,
          leftAt,
          status: member.status,
          mostRecentAction: member.most_recent_action || undefined,
          mostRecentActionAt: member.most_recent_action_at || undefined,
        });
      }
    }

    res.json({ members: owners });
  } catch (err: any) {
    console.error('Members fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch members' });
  }
});

router.get('/memberships/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const productIds = parseCsv(req.query.product_ids || req.query.productIds);
    if (productIds.length === 0) {
      return res.status(400).json({ error: 'product_ids is required' });
    }

    const statuses = parseCsv(req.query.statuses);
    const statusFilter = statuses.length > 0 ? statuses : ['joined', 'left'];

    const rows: Array<{
      productId: string;
      user: {
        id: string;
        username?: string;
        email?: string;
        name?: string;
      };
      joinedAt?: string | null;
      leftAt?: string | null;
      status?: string;
      mostRecentAction?: string;
      mostRecentActionAt?: string;
    }> = [];

    for (const productId of productIds) {
      for await (const member of sdk.members.list({
        company_id: companyId,
        product_ids: [productId],
        statuses: statusFilter,
      } as any)) {
        if (!member.user?.id) continue;
        const leftAt =
          member.status === 'left'
            ? (member.most_recent_action_at || null)
            : null;
        rows.push({
          productId,
          user: {
            id: member.user.id,
            username: member.user.username || undefined,
            email: member.user.email || undefined,
            name: member.user.name || undefined,
          },
          joinedAt: member.joined_at || null,
          leftAt,
          status: member.status,
          mostRecentAction: member.most_recent_action || undefined,
          mostRecentActionAt: member.most_recent_action_at || undefined,
        });
      }
    }

    res.json({ companyId, productIds, members: rows });
  } catch (err: any) {
    console.error('Memberships fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch memberships' });
  }
});

router.get('/dropoff-users/:companyId/:fromProductId/:toProductId', async (req, res) => {
  try {
    const { companyId, fromProductId, toProductId } = req.params;

    const fromOwners: Array<{
      id: string;
      username?: string;
      email?: string;
      name?: string;
      joinedAt?: string | null;
      status?: string;
      mostRecentAction?: string;
      mostRecentActionAt?: string;
    }> = [];

    const toOwnerIds = new Set<string>();

    for await (const member of sdk.members.list({
      company_id: companyId,
      product_ids: [toProductId],
      statuses: ['joined'],
    } as any)) {
      if (!member.user?.id) continue;
      toOwnerIds.add(member.user.id);
    }

    for await (const member of sdk.members.list({
      company_id: companyId,
      product_ids: [fromProductId],
      statuses: ['joined'],
    } as any)) {
      if (!member.user?.id) continue;
      if (toOwnerIds.has(member.user.id)) continue;
      fromOwners.push({
        id: member.user.id,
        username: member.user.username || undefined,
        email: member.user.email || undefined,
        name: member.user.name || undefined,
        joinedAt: member.joined_at || null,
        status: member.status,
        mostRecentAction: member.most_recent_action || undefined,
        mostRecentActionAt: member.most_recent_action_at || undefined,
      });
    }

    res.json({
      companyId,
      fromProductId,
      toProductId,
      users: fromOwners,
    });
  } catch (err: any) {
    console.error('Dropoff users fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch dropoff users' });
  }
});

export default router;

