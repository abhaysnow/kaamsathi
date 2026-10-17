import type { Language } from '../types/domain.js';

const EMERGENCY_RE = [
  /\b(accident|injur(y|ed)|bleeding|ambulance|emergency|unconscious|attack(ed)?|durghatna|haadsa|chot|khoon)\b/i,
  /(दुर्घटना|एक्सीडेंट|चोट|खून|हादसा|आपातकाल)/,
  /(ਹਾਦਸਾ|ਸੱਟ|ਐਕਸੀਡੈਂਟ|ਖੂਨ)/,
  /(দুর্ঘটনা|আঘাত)/,
  /(விபத்து|காயம்)/,
  /(ప్రమాదం|గాయం)/,
  /(अपघात|जखम)/,
];

/** Deterministic: emergency help must not depend on the model behaving. */
export function detectEmergency(message: string): boolean {
  return EMERGENCY_RE.some((r) => r.test(message));
}

const TEXT: Partial<Record<Language, string>> = {
  en: 'If someone is badly hurt or in danger, call 112 (national emergency number) right now. Everything else can wait.',
  hi: 'अगर कोई गंभीर रूप से घायल है या खतरे में है, तो अभी 112 (राष्ट्रीय आपातकालीन नंबर) पर कॉल करें। बाकी सब बाद में हो सकता है।',
  pa: 'ਜੇ ਕੋਈ ਗੰਭੀਰ ਜ਼ਖਮੀ ਹੈ ਜਾਂ ਖ਼ਤਰੇ ਵਿੱਚ ਹੈ, ਤਾਂ ਹੁਣੇ 112 (ਰਾਸ਼ਟਰੀ ਐਮਰਜੈਂਸੀ ਨੰਬਰ) ਤੇ ਕਾਲ ਕਰੋ। ਬਾਕੀ ਸਭ ਬਾਅਦ ਵਿੱਚ ਹੋ ਸਕਦਾ ਹੈ।',
};

export const emergencyText = (l: Language) => TEXT[l] ?? TEXT.en!;
