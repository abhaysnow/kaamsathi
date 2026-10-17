import { Router } from 'express';
import {
  chatBodySchema,
  documentChecklistBodySchema,
  documentDraftBodySchema,
  explainEarningsBodySchema,
  schemeSearchBodySchema,
} from '../schemas/assistant.js';
import {
  createEarningsSchema,
  listEarningsQuery,
  summaryQuery,
  updateEarningsSchema,
} from '../schemas/earnings.js';
import { objectIdParam } from '../schemas/common.js';
import { grievanceDraftBodySchema, grievanceUpdateSchema } from '../schemas/grievance.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';
import type { AppContext } from '../services/context.js';
import { chat } from '../services/workerAssistant.js';
import { buildSummary, explainEarnings } from '../services/earningsService.js';
import { searchSchemes } from '../services/schemeGuidance.js';
import { documentChecklist, documentDraft } from '../services/documentAssistant.js';
import { draftGrievance } from '../services/grievanceDraft.js';
import { DEMO_GRIEVANCE_SCENARIO, DEMO_QUESTIONS, ensureDemoSeed } from '../services/demoData.js';
import { toCsv } from '../utils/earnings.js';
import { notFound } from '../utils/errors.js';
import type { z } from 'zod';

type Wrap = (
  fn: (req: import('express').Request, res: import('express').Response) => Promise<unknown>,
) => import('express').RequestHandler;
const wrap: Wrap = (fn) => (req, res, next) => {
  fn(req, res).catch(next);
};

export function buildRouter(ctx: AppContext): Router {
  const r = Router();
  const ai = aiLimiter(Number(process.env.AI_RATE_LIMIT ?? 20));

  r.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      ai: {
        provider: ctx.provider.name,
        model: ctx.provider.model,
        isMock: ctx.provider.name === 'mock',
      },
      storage: ctx.repos.kind,
      demoAccountEnabled: ctx.config.demo.enabled,
      knowledgeRecords: ctx.knowledge.all().length,
    });
  });

  r.get('/demo/info', (_req, res) => {
    res.json({
      questions: DEMO_QUESTIONS,
      grievanceScenario: DEMO_GRIEVANCE_SCENARIO,
      notice: 'All demo data is fictional.',
    });
  });

  // Curated public guidance (no personal data).
  r.get('/knowledge/sources', (_req, res) => {
    res.json({
      records: ctx.knowledge.all().map((k) => ({
        id: k.id,
        title: k.title,
        kind: k.kind,
        scope: k.scope,
        summary: k.summary,
        steps: k.steps,
        topic: k.kind === 'rights' ? k.topic : undefined,
        channels: k.kind === 'rights' ? k.channels : [],
        contentReview: k.contentReview,
        sources: k.sources,
        limitations: k.limitations,
      })),
      notice:
        'Link checks are automated. Content review by a human is still pending unless stated otherwise.',
    });
  });
  // ---- Everything below needs a signed-in user (checked server-side on every request). ----
  r.use(requireAuth);

  // ---- Assistant ----
  r.post(
    '/assistant/chat',
    ai,
    validate(chatBodySchema),
    wrap(async (req, res) => {
      await ensureDemoSeed(ctx, req.ownerId);
      res.json(await chat(ctx, req.ownerId, req.body as z.infer<typeof chatBodySchema>));
    }),
  );

  // ---- Earnings ----
  r.get(
    '/earnings/entries',
    validate(listEarningsQuery, 'query'),
    wrap(async (req, res) => {
      await ensureDemoSeed(ctx, req.ownerId);
      const q = req.query as z.infer<typeof listEarningsQuery>;
      res.json({ entries: await ctx.repos.earnings.list(req.ownerId, q), isDemo: req.isDemo });
    }),
  );
  r.post(
    '/earnings/entries',
    validate(createEarningsSchema),
    wrap(async (req, res) => {
      const entry = await ctx.repos.earnings.create(
        req.ownerId,
        req.body as z.infer<typeof createEarningsSchema>,
        req.isDemo ? 'demo_sample' : 'user_entered',
      );
      res.status(201).json({ entry });
    }),
  );
  r.patch(
    '/earnings/entries/:id',
    validate(objectIdParam, 'params'),
    validate(updateEarningsSchema),
    wrap(async (req, res) => {
      const entry = await ctx.repos.earnings.update(
        req.ownerId,
        String(req.params.id),
        req.body as z.infer<typeof updateEarningsSchema>,
      );
      if (!entry) throw notFound('Entry');
      res.json({ entry });
    }),
  );
  r.delete(
    '/earnings/entries/:id',
    validate(objectIdParam, 'params'),
    wrap(async (req, res) => {
      if (!(await ctx.repos.earnings.remove(req.ownerId, String(req.params.id))))
        throw notFound('Entry');
      res.status(204).end();
    }),
  );
  r.get(
    '/earnings/summary',
    validate(summaryQuery, 'query'),
    wrap(async (req, res) => {
      await ensureDemoSeed(ctx, req.ownerId);
      const q = req.query as unknown as z.infer<typeof summaryQuery>;
      const { entries, ...summary } = await buildSummary(ctx, req.ownerId, q.period, q.anchor);
      void entries;
      res.json({ ...summary, isDemo: req.isDemo });
    }),
  );
  r.get(
    '/earnings/export.csv',
    wrap(async (req, res) => {
      await ensureDemoSeed(ctx, req.ownerId);
      res
        .type('text/csv')
        .set('Content-Disposition', 'attachment; filename="kaamsaathi-earnings.csv"');
      res.send(toCsv(await ctx.repos.earnings.list(req.ownerId)));
    }),
  );
  r.post(
    '/earnings/explain',
    ai,
    validate(explainEarningsBodySchema),
    wrap(async (req, res) => {
      await ensureDemoSeed(ctx, req.ownerId);
      res.json(
        await explainEarnings(
          ctx,
          req.ownerId,
          req.body as z.infer<typeof explainEarningsBodySchema>,
        ),
      );
    }),
  );

  // ---- Schemes ----
  r.post(
    '/schemes/search',
    ai,
    validate(schemeSearchBodySchema),
    wrap(async (req, res) => {
      res.json(await searchSchemes(ctx, req.body as z.infer<typeof schemeSearchBodySchema>));
    }),
  );

  // ---- Documents ----
  r.post(
    '/documents/checklist',
    ai,
    validate(documentChecklistBodySchema),
    wrap(async (req, res) => {
      res.json(
        await documentChecklist(ctx, req.body as z.infer<typeof documentChecklistBodySchema>),
      );
    }),
  );
  r.post(
    '/documents/draft',
    ai,
    validate(documentDraftBodySchema),
    wrap(async (req, res) => {
      res.json(await documentDraft(ctx, req.body as z.infer<typeof documentDraftBodySchema>));
    }),
  );

  // ---- Grievances ----
  r.post(
    '/grievances/draft',
    ai,
    validate(grievanceDraftBodySchema),
    wrap(async (req, res) => {
      const body = req.body as z.infer<typeof grievanceDraftBodySchema>;
      const result = await draftGrievance(ctx, { language: body.language, facts: body.facts });
      // Stored only with explicit consent; otherwise the draft lives only in this response.
      const saved = body.saveWithConsent
        ? await ctx.repos.grievances.create(req.ownerId, {
            language: body.language,
            draft: result.draft,
            provider: result.provider.name,
          })
        : null;
      res.status(saved ? 201 : 200).json({ ...result, saved: Boolean(saved), id: saved?.id });
    }),
  );
  r.get(
    '/grievances',
    wrap(async (req, res) => {
      res.json({ grievances: await ctx.repos.grievances.list(req.ownerId) });
    }),
  );
  r.patch(
    '/grievances/:id',
    validate(objectIdParam, 'params'),
    validate(grievanceUpdateSchema),
    wrap(async (req, res) => {
      const g = await ctx.repos.grievances.update(
        req.ownerId,
        String(req.params.id),
        req.body as z.infer<typeof grievanceUpdateSchema>,
      );
      if (!g) throw notFound('Complaint');
      res.json({ grievance: g });
    }),
  );
  r.delete(
    '/grievances/:id',
    validate(objectIdParam, 'params'),
    wrap(async (req, res) => {
      if (!(await ctx.repos.grievances.remove(req.ownerId, String(req.params.id))))
        throw notFound('Complaint');
      res.status(204).end();
    }),
  );

  // ---- Privacy: delete everything this session owns ----
  r.delete(
    '/me/data',
    wrap(async (req, res) => {
      const [e, g] = await Promise.all([
        ctx.repos.earnings.removeAll(req.ownerId),
        ctx.repos.grievances.removeAll(req.ownerId),
      ]);
      res.json({ deleted: { earnings: e, grievances: g } });
    }),
  );

  return r;
}
