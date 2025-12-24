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

