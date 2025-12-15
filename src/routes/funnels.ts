import { Router } from 'express';
import { supabase } from '../db/db.js';

const router = Router();

router.get('/:experienceId', async (req, res) => {
  try {
    const { experienceId } = req.params;

    const { data, error } = await supabase
      .from('funnels')
      .select('*')
      .eq('experience_id', experienceId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { experience_id, company_id, steps, counting_mode } = req.body;

    const { data: existing } = await supabase
      .from('funnels')
      .select('id')
      .eq('experience_id', experience_id)
      .maybeSingle();

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('funnels')
        .update({ steps, counting_mode, company_id })
        .eq('experience_id', experience_id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('funnels')
        .insert([{ experience_id, company_id, steps, counting_mode }])
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      result = data;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:experienceId', async (req, res) => {
  try {
    const { experienceId } = req.params;

    const { error } = await supabase
      .from('funnels')
      .delete()
      .eq('experience_id', experienceId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

