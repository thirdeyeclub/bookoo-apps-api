import { Router } from 'express';
import Whop from '@whop/sdk';
import { supabase } from '../db/db.js';

const router = Router();

const sdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || '',
  appID: process.env.WHOP_APP_ID || '',
});

function parseRangeDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) return 30;
  const clamped = Math.max(1, Math.min(365, Math.floor(n)));
  return clamped;
}

function getCohortKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[clamped] ?? null;
}

router.post('/capture', async (req, res) => {
  try {
    const { company_id, product_ids } = req.body as {
      company_id?: string;
      product_ids?: string[];
    };

    if (!company_id || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'company_id and product_ids are required' });
    }

    const snapshotAt = new Date().toISOString();

    const results: Array<{ product_id: string; member_count: number }> = [];

    for (const productId of product_ids) {
      const members: Array<{
        user_id: string;
        joined_at?: string | null;
        most_recent_action_at?: string | null;
      }> = [];

      for await (const member of sdk.members.list({
        company_id,
        product_ids: [productId],
        statuses: ['joined'],
      } as any)) {
        if (!member.user?.id) continue;
        members.push({
          user_id: member.user.id,
          joined_at: member.joined_at || null,
          most_recent_action_at: member.most_recent_action_at || null,
        });
      }

      if (members.length > 0) {
        const upsertRows = members.map((m) => ({
          company_id,
          product_id: productId,
          user_id: m.user_id,
          joined_at: m.joined_at,
          last_seen_at: snapshotAt,
          most_recent_action_at: m.most_recent_action_at,
          left_at: null,
        }));

        const upsertRes = await supabase
          .from('product_memberships')
          .upsert(upsertRows, { onConflict: 'company_id,product_id,user_id' });

        if (upsertRes.error) {
          return res.status(500).json({ error: upsertRes.error.message });
        }
      }

      const activeRes = await supabase
        .from('product_memberships')
        .select('user_id')
        .eq('company_id', company_id)
        .eq('product_id', productId)
        .is('left_at', null);

      if (activeRes.error) {
        return res.status(500).json({ error: activeRes.error.message });
      }

      const currentSet = new Set(members.map((m) => m.user_id));
      const missing = (activeRes.data || [])
        .map((r: any) => r.user_id as string)
        .filter((id) => !currentSet.has(id));

      if (missing.length > 0) {
        const leftRes = await supabase
          .from('product_memberships')
          .update({ left_at: snapshotAt })
          .eq('company_id', company_id)
          .eq('product_id', productId)
          .in('user_id', missing);

        if (leftRes.error) {
          return res.status(500).json({ error: leftRes.error.message });
        }
      }

      const snapRes = await supabase.from('product_snapshots').insert({
        company_id,
        product_id: productId,
        snapshot_at: snapshotAt,
        member_count: members.length,
      });

      if (snapRes.error) {
        return res.status(500).json({ error: snapRes.error.message });
      }

      results.push({ product_id: productId, member_count: members.length });
    }

    res.json({ snapshot_at: snapshotAt, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Capture failed' });
  }
});

router.get('/cohorts', async (req, res) => {
  try {
    const experienceId = (req.query.experienceId || req.query.experience_id) as string | undefined;
    if (!experienceId) {
      return res.status(400).json({ error: 'experienceId is required' });
    }

    const rangeDays = parseRangeDays(req.query.rangeDays);
    const now = new Date();
    const since = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    const funnelRes = await supabase
      .from('funnels')
      .select('*')
      .eq('experience_id', experienceId)
      .maybeSingle();

    if (funnelRes.error) {
      return res.status(500).json({ error: funnelRes.error.message });
    }
    if (!funnelRes.data) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const funnel = funnelRes.data as any;
    const companyId = funnel.company_id as string;
    const steps: any[] = Array.isArray(funnel.steps) ? funnel.steps : [];
    const productIds: string[] = Array.from(
      new Set(
        steps
          .map((s) => (typeof s?.productId === 'string' ? (s.productId as string) : null))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    if (productIds.length === 0) {
      return res.json({
        rangeDays,
        since: sinceIso,
        companyId,
        productIds: [],
        snapshots: {},
        retention: {},
        stageCohorts: [],
      });
    }

    const snapshotsRes = await supabase
      .from('product_snapshots')
      .select('product_id,snapshot_at,member_count')
      .eq('company_id', companyId)
      .in('product_id', productIds)
      .gte('snapshot_at', sinceIso)
      .order('snapshot_at', { ascending: true });

    if (snapshotsRes.error) {
      return res.status(500).json({ error: snapshotsRes.error.message });
    }

    const snapshots: Record<string, Array<{ snapshot_at: string; member_count: number }>> = {};
    for (const pid of productIds) snapshots[pid] = [];
    for (const row of snapshotsRes.data || []) {
      const pid = (row as any).product_id as string;
      if (!snapshots[pid]) snapshots[pid] = [];
      snapshots[pid].push({
        snapshot_at: (row as any).snapshot_at as string,
        member_count: (row as any).member_count as number,
      });
    }

    const retentionDays = [7, 30];
    const retention: Record<
      string,
      Record<string, { base: number; retained: number; rate: number }>
    > = {};

    for (const pid of productIds) {
      const membersRes = await supabase
        .from('product_memberships')
        .select('joined_at,last_seen_at,left_at')
        .eq('company_id', companyId)
        .eq('product_id', pid)
        .gte('joined_at', sinceIso)
        .not('joined_at', 'is', null);

      if (membersRes.error) {
        return res.status(500).json({ error: membersRes.error.message });
      }

      const rows = (membersRes.data || []) as any[];
      retention[pid] = {};

      for (const d of retentionDays) {
        const cutoff = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        const eligible = rows.filter((r) => new Date(r.joined_at) <= cutoff);
        const base = eligible.length;

        let retained = 0;
        for (const r of eligible) {
          const joinedAt = new Date(r.joined_at);
          const target = new Date(joinedAt.getTime() + d * 24 * 60 * 60 * 1000);
          const lastSeenAt = new Date(r.last_seen_at);
          const leftAt = r.left_at ? new Date(r.left_at) : null;
          const ok = lastSeenAt >= target && (!leftAt || leftAt >= target);
          if (ok) retained += 1;
        }

        retention[pid][`day${d}`] = {
          base,
          retained,
          rate: base > 0 ? (retained / base) * 100 : 0,
        };
      }
    }

    const orderedSteps = [...steps].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const stageCohorts: Array<{
      fromProductId: string;
      toProductId: string;
      fromName: string;
      toName: string;
      cohorts: Array<{
        cohort: string;
        fromCount: number;
        toCount: number;
        conversionRate: number;
        medianHours: number | null;
        p75Hours: number | null;
      }>;
    }> = [];

    for (let i = 0; i < orderedSteps.length - 1; i++) {
      const fromProductId = orderedSteps[i]?.productId as string | undefined;
      const toProductId = orderedSteps[i + 1]?.productId as string | undefined;
      if (!fromProductId || !toProductId) continue;

      const fromName = orderedSteps[i]?.product?.title || `Step ${i + 1}`;
      const toName = orderedSteps[i + 1]?.product?.title || `Step ${i + 2}`;

      const fromRes = await supabase
        .from('product_memberships')
        .select('user_id,joined_at')
        .eq('company_id', companyId)
        .eq('product_id', fromProductId)
        .gte('joined_at', sinceIso)
        .not('joined_at', 'is', null);

      if (fromRes.error) {
        return res.status(500).json({ error: fromRes.error.message });
      }

      const fromRows = (fromRes.data || []) as any[];
      const fromByUser = new Map<string, Date>();
      for (const r of fromRows) fromByUser.set(r.user_id as string, new Date(r.joined_at));
      const userIds = Array.from(fromByUser.keys());

      if (userIds.length === 0) {
        stageCohorts.push({
          fromProductId,
          toProductId,
          fromName,
          toName,
          cohorts: [],
        });
        continue;
      }

      const toRes = await supabase
        .from('product_memberships')
        .select('user_id,joined_at')
        .eq('company_id', companyId)
        .eq('product_id', toProductId)
        .in('user_id', userIds)
        .not('joined_at', 'is', null);

      if (toRes.error) {
        return res.status(500).json({ error: toRes.error.message });
      }

      const toByUser = new Map<string, Date>();
      for (const r of (toRes.data || []) as any[]) toByUser.set(r.user_id as string, new Date(r.joined_at));

      const byCohort = new Map<
        string,
        { fromCount: number; toCount: number; deltasHours: number[] }
      >();

      for (const [uid, fromJoinedAt] of fromByUser.entries()) {
        const key = getCohortKey(fromJoinedAt);
        if (!byCohort.has(key)) byCohort.set(key, { fromCount: 0, toCount: 0, deltasHours: [] });
        const bucket = byCohort.get(key)!;
        bucket.fromCount += 1;

        const toJoinedAt = toByUser.get(uid);
        if (toJoinedAt) {
          bucket.toCount += 1;
          const deltaMs = toJoinedAt.getTime() - fromJoinedAt.getTime();
          if (deltaMs >= 0) bucket.deltasHours.push(deltaMs / (60 * 60 * 1000));
        }
      }

      const cohorts = Array.from(byCohort.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([cohort, v]) => {
          const sorted = [...v.deltasHours].sort((a, b) => a - b);
          const medianHours = percentile(sorted, 50);
          const p75Hours = percentile(sorted, 75);
          return {
            cohort,
            fromCount: v.fromCount,
            toCount: v.toCount,
            conversionRate: v.fromCount > 0 ? (v.toCount / v.fromCount) * 100 : 0,
            medianHours,
            p75Hours,
          };
        });

      stageCohorts.push({
        fromProductId,
        toProductId,
        fromName,
        toName,
        cohorts,
      });
    }

    res.json({
      rangeDays,
      since: sinceIso,
      companyId,
      productIds,
      snapshots,
      retention,
      stageCohorts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cohorts failed' });
  }
});

export default router;


