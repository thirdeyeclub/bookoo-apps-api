import { Router } from 'express';
import Whop from '@whop/sdk';

const router = Router();

const sdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || '',
  appID: process.env.WHOP_APP_ID || '',
});

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
    for await (const member of sdk.members.list({
      company_id: companyId,
      product_ids: [productId],
      statuses: ['joined']
    } as any)) {
      if (member.user) {
        owners.push({
          id: member.user.id,
          username: member.user.username || undefined,
          email: member.user.email || undefined,
          name: member.user.name || undefined,
          joinedAt: member.joined_at,
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

export default router;

