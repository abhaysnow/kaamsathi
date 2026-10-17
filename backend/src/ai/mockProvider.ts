import type { GrievanceFacts, Language } from '../types/domain.js';
import { periodWord, t } from './mockStrings.js';
import type { AIProvider, AIRequest, AIResponse } from './types.js';

interface ChatCtx {
  sources: Array<{ id: string; title: string; summary: string; steps: string[] }>;
  earnings?: {
    period: 'day' | 'week' | 'month';
    entries: number;
    gross: number;
    expenses: number;
    deductions: number;
    net: number;
    hours: number;
  };
}
interface ExplainCtx {
  period: 'day' | 'week' | 'month';
  totals: { gross: number; expenses: number; deductions: number; net: number; entries: number };
  flags: Array<{ date: string; detail: string }>;
  biggestCost?: { item: string; amount: number };
}
interface SchemeCtx {
  items: Array<{ schemeId: string; reasons: string[] }>;
}
interface DraftCtx {
  kind: string;
  workerName?: string;
  details: string;
}
interface GrievanceCtx {
  facts: GrievanceFacts;
}

const json = (o: unknown) => JSON.stringify(o);

/**
 * Deterministic stand-in used when no ANTHROPIC_API_KEY is configured. It is NOT an AI model:
 * every response is built from templates plus retrieved/verified data, and the API marks it
 * with provider "mock" so the UI can show an unmissable "Demo AI" badge.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-deterministic-v1';

  async generate(req: AIRequest): Promise<AIResponse> {
    const l = req.language;
    const ctx = req.mockContext;
    let out: unknown;
    switch (req.feature) {
      case 'chat':
        out = this.chat(l, ctx as ChatCtx);
        break;
      case 'explain_earnings':
        out = this.explain(l, ctx as ExplainCtx);
        break;
      case 'scheme_guidance':
        out = this.schemes(l, ctx as SchemeCtx);
        break;
      case 'document_checklist':
        out = { explanation: t(l, 'checklistIntro'), tips: [] };
        break;
      case 'document_draft':
        out = this.draft(l, ctx as DraftCtx);
        break;
      case 'grievance':
        out = this.grievance(l, ctx as GrievanceCtx);
        break;
    }
    return { text: json(out), provider: 'mock', model: this.model };
  }

  private chat(l: Language, c: ChatCtx) {
    const parts: string[] = [];
    if (c.earnings) {
      parts.push(
        c.earnings.entries === 0
          ? t(l, 'earningsNone')
          : t(l, 'earningsLine', {
              period: periodWord(c.earnings.period, l),
              gross: c.earnings.gross,
              expenses: c.earnings.expenses,
              deductions: c.earnings.deductions,
              net: c.earnings.net,
              hours: c.earnings.hours,
            }),
      );
    }
    if (c.sources.length === 0) {
      if (!c.earnings) parts.push(t(l, 'noSources'));
      return {
        answer: parts.join('\n\n'),
        followUpQuestions: c.earnings ? [] : [t(l, 'q_state'), t(l, 'q_work')],
        usedSourceIds: [],
        couldNotVerify: !c.earnings,
      };
    }
    const top = c.sources[0]!;
    parts.push(`${t(l, 'chatIntro')}\n${top.title}\n${top.summary}`);
    if (top.steps.length)
      parts.push(`${t(l, 'steps')}\n${top.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    parts.push(t(l, 'verify'));
    return {
      answer: parts.join('\n\n'),
      followUpQuestions: [t(l, 'q_state')],
      usedSourceIds: [top.id],
      couldNotVerify: false,
    };
  }

  private explain(l: Language, c: ExplainCtx) {
    const p = periodWord(c.period, l);
    const explanation =
      c.totals.entries === 0
        ? t(l, 'earningsNone')
        : [
            t(l, 'explainNet', {
              period: p,
              gross: c.totals.gross,
              expenses: c.totals.expenses,
              deductions: c.totals.deductions,
              net: c.totals.net,
            }),
            c.biggestCost
              ? t(l, 'explainBiggest', { item: c.biggestCost.item, amount: c.biggestCost.amount })
              : '',
          ]
            .filter(Boolean)
            .join(' ');
    return {
      explanation,
      tips: [t(l, 'explainTip')],
      checkEntries: c.flags
        .slice(0, 3)
        .map((f) => t(l, 'explainFlag', { date: f.date, detail: f.detail })),
    };
  }

  private schemes(l: Language, c: SchemeCtx) {
    return {
      intro: c.items.length ? t(l, 'schemeIntro') : t(l, 'schemeNone'),
      items: c.items.map((i) => ({
        schemeId: i.schemeId,
        whyRelevant: t(l, 'schemeWhy', { reason: i.reasons.join('; ') }),
        nextStep: t(l, 'schemeNext'),
      })),
      uncertainty: t(l, 'schemeUncertain'),
    };
  }

  private draft(l: Language, c: DraftCtx) {
    const name = c.workerName ?? '[PLACEHOLDER: name]';
    return {
      title: `${t(l, 'subjectPrefix')} ${c.kind.replace(/_/g, ' ')}`,
      body: [
        t(l, 'draftNote'),
        '',
        t(l, 'greeting'),
        '',
        c.details,
        '',
        t(l, 'regards'),
        name,
      ].join('\n'),
    };
  }

  /** Worker text is inserted verbatim; nothing is paraphrased, so facts cannot drift. */
  private grievance(l: Language, c: GrievanceCtx) {
    const f = c.facts;
    const lines = [t(l, 'greeting'), '', t(l, 'iWork', { platform: f.platformOrEmployer })];
    if (f.incidentDate) lines.push(t(l, 'onDate', { date: f.incidentDate }));
    if (f.amountRupees !== undefined) lines.push(t(l, 'amountLine', { amount: f.amountRupees }));
    lines.push('', t(l, 'whatHappenedLead'), f.whatHappened);
    if (f.stepsAlreadyTaken) lines.push('', t(l, 'tried'), f.stepsAlreadyTaken);
    if (f.evidenceAvailable.length)
      lines.push('', t(l, 'evidence', { items: f.evidenceAvailable.join(', ') }));
    lines.push(
      '',
      t(l, 'requestLead'),
      f.desiredResolution ?? t(l, 'requestDefault'),
      '',
      t(l, 'thanks'),
      '',
      t(l, 'regards'),
      '[PLACEHOLDER: your name]',
    );
    return {
      subject: `${t(l, 'subjectPrefix')} ${t(l, `type_${f.type}`)}`,
      finalMessage: lines.join('\n'),
      evidenceChecklist: [],
    };
  }
}
