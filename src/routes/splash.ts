import { Router } from 'express';
import { randomBytes } from 'crypto';
import { supabase } from '../db/db.js';

const router = Router();

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function base62(bytes: Uint8Array): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let num = 0n;
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }
  if (num === 0n) return '0';
  let out = '';
  while (num > 0n) {
    const rem = Number(num % 62n);
    out = alphabet[rem] + out;
    num = num / 62n;
  }
  return out;
}

async function generateUniqueShortCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = base62(randomBytes(6)).slice(0, 8);
    const { data, error } = await supabase
      .from('splash_pages')
      .select('id')
      .eq('short_code', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  return base62(randomBytes(10)).slice(0, 12);
}

router.get('/pages', async (req, res) => {
  try {
    const experienceId = parseNonEmptyString(req.query.experienceId || req.query.experience_id);
    if (!experienceId) {
      return res.status(400).json({ error: 'experienceId is required' });
    }

    const { data, error } = await supabase
      .from('splash_pages')
      .select('*')
      .eq('experience_id', experienceId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ pages: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list pages' });
  }
});

router.post('/pages', async (req, res) => {
  try {
    const company_id = parseNonEmptyString(req.body?.company_id);
    const experience_id = parseNonEmptyString(req.body?.experience_id);
    const created_by_user_id = parseNonEmptyString(req.body?.created_by_user_id);
    const product_id = parseNonEmptyString(req.body?.product_id);
    const slug = parseNonEmptyString(req.body?.slug);
    const template_key = parseNonEmptyString(req.body?.template_key) || 'droplet_v1';
    const config = typeof req.body?.config === 'object' && req.body?.config ? req.body.config : {};
    const publish = Boolean(req.body?.publish);

    if (!company_id || !experience_id || !created_by_user_id || !product_id || !slug) {
      return res.status(400).json({
        error: 'company_id, experience_id, created_by_user_id, product_id, slug are required',
      });
    }

    const { data: existingSlug, error: existingSlugErr } = await supabase
      .from('splash_pages')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existingSlugErr) return res.status(500).json({ error: existingSlugErr.message });
    if (existingSlug) return res.status(409).json({ error: 'Slug already exists' });

    const short_code = await generateUniqueShortCode();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('splash_pages')
      .insert([
        {
          company_id,
          experience_id,
          created_by_user_id,
          product_id,
          slug,
          short_code,
          template_key,
          config,
          status: publish ? 'published' : 'draft',
          published_at: publish ? nowIso : null,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create page' });
  }
});

router.post('/pages/:id/publish', async (req, res) => {
  try {
    const idRaw = req.params.id;
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('splash_pages')
      .update({ status: 'published', published_at: nowIso })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to publish page' });
  }
});

router.patch('/pages/:id', async (req, res) => {
  try {
    const idRaw = req.params.id;
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const created_by_user_id = parseNonEmptyString(req.body?.created_by_user_id);
    if (!created_by_user_id) return res.status(400).json({ error: 'created_by_user_id is required' });

    const cfg = typeof req.body?.config === 'object' && req.body?.config ? req.body.config : {};
    const headline = typeof cfg.headline === 'string' ? cfg.headline.trim() : null;
    const detail_line = typeof cfg.detail_line === 'string' ? cfg.detail_line.trim() : null;
    const logo_url = typeof cfg.logo_url === 'string' ? cfg.logo_url.trim() : null;

    const { data: existing, error: existingErr } = await supabase
      .from('splash_pages')
      .select('id,config,created_by_user_id')
      .eq('id', id)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: existingErr.message });
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    if ((existing as any).created_by_user_id !== created_by_user_id) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const existingConfig = (existing as any).config && typeof (existing as any).config === 'object' ? (existing as any).config : {};
    const nextConfig = {
      ...existingConfig,
      headline: headline || null,
      detail_line: detail_line || null,
      logo_url: logo_url || null,
    };

    const { data, error } = await supabase
      .from('splash_pages')
      .update({ config: nextConfig })
      .eq('id', id)
      .eq('created_by_user_id', created_by_user_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update page' });
  }
});

router.delete('/pages/:id', async (req, res) => {
  try {
    const idRaw = req.params.id;
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const created_by_user_id = parseNonEmptyString(req.query.created_by_user_id) || parseNonEmptyString(req.body?.created_by_user_id);
    if (!created_by_user_id) return res.status(400).json({ error: 'created_by_user_id is required' });

    const { data: existing, error: existingErr } = await supabase
      .from('splash_pages')
      .select('id,created_by_user_id')
      .eq('id', id)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: existingErr.message });
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    if ((existing as any).created_by_user_id !== created_by_user_id) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { error } = await supabase
      .from('splash_pages')
      .delete()
      .eq('id', id)
      .eq('created_by_user_id', created_by_user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete page' });
  }
});

router.get('/public/:slug', async (req, res) => {
  try {
    const slug = parseNonEmptyString(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'Invalid slug' });

    const { data, error } = await supabase
      .from('splash_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Page not found' });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load page' });
  }
});

router.get('/resolve/:shortCode', async (req, res) => {
  try {
    const shortCode = parseNonEmptyString(req.params.shortCode);
    if (!shortCode) return res.status(400).json({ error: 'Invalid shortCode' });

    const { data, error } = await supabase
      .from('splash_pages')
      .select('slug')
      .eq('short_code', shortCode)
      .eq('status', 'published')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json({ slug: (data as any).slug });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resolve' });
  }
});

router.post('/public/:slug/leads', async (req, res) => {
  try {
    const slug = parseNonEmptyString(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'Invalid slug' });

    const email = parseNonEmptyString(req.body?.email);
    const name = parseNonEmptyString(req.body?.name);
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data: page, error: pageErr } = await supabase
      .from('splash_pages')
      .select('id,company_id,experience_id,created_by_user_id')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (pageErr) return res.status(500).json({ error: pageErr.message });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const payload = {
      splash_page_id: (page as any).id as number,
      company_id: (page as any).company_id as string,
      experience_id: (page as any).experience_id as string,
      created_by_user_id: (page as any).created_by_user_id as string,
      email,
      name,
      utm_source: parseNonEmptyString(req.body?.utm_source),
      utm_medium: parseNonEmptyString(req.body?.utm_medium),
      utm_campaign: parseNonEmptyString(req.body?.utm_campaign),
      utm_content: parseNonEmptyString(req.body?.utm_content),
      utm_term: parseNonEmptyString(req.body?.utm_term),
      referrer: parseNonEmptyString(req.body?.referrer),
      landing_url: parseNonEmptyString(req.body?.landing_url),
    };

    const { error: insertErr } = await supabase.from('splash_leads').upsert([payload], {
      onConflict: 'splash_page_id,email',
      ignoreDuplicates: true,
    } as any);

    if (insertErr) return res.status(500).json({ error: insertErr.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to capture lead' });
  }
});

export default router;


