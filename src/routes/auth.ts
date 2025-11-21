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
      email: user.email,
      profilePictureUrl: user.profile_picture_url,
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

export default router;

