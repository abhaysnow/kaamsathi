import type { Language } from '../types/domain.js';

type Dict = Record<string, string>;

/**
 * Fixed phrases for the MOCK provider only. English, Hindi and Punjabi are complete; Bengali,
 * Tamil, Telugu and Marathi cover the core chat phrases; other languages fall back to English.
 * A live Claude model translates everything itself — this table exists so demos are predictable.
 */
const en: Dict = {
  chatIntro: 'Here is what the verified sources say:',
  steps: 'What you can do:',
  verify: 'Please confirm on the official site linked below. Rules can change.',
  noSources:
    'I could not verify this from my trusted sources, so I will not guess. Can you tell me a little more (your state and type of work)?',
  q_state: 'Which state are you in?',
  q_work: 'Which platform or kind of work do you do?',
  earningsLine:
    'From the entries you recorded for this {period}: gross ₹{gross}, expenses ₹{expenses}, deductions ₹{deductions}, so net ₹{net} for {hours} hours.',
  earningsNone:
    "You have not recorded any earnings for this period yet. Add today's earnings in the Earnings tab.",
  explainNet:
    'Net = gross − expenses − deductions. This {period}: gross ₹{gross}, expenses ₹{expenses}, deductions ₹{deductions}, so net ₹{net}.',
  explainBiggest: 'Your biggest cost was {item} (₹{amount}).',
  explainFlag: 'Please re-check {date}: {detail}.',
  explainTip: 'Write down fuel and other costs every day so your net income is accurate.',
  schemeIntro:
    'These schemes may be relevant to you. Only the official portal can confirm eligibility.',
  schemeWhy: 'May be relevant: {reason}',
  schemeNext: 'Next step: open the official link and check the criteria.',
  schemeNone: 'I could not find a matching scheme in my verified list. Try changing your answers.',
  schemeUncertain:
    'Potentially relevant — verify eligibility. We cannot say whether a scheme is open right now.',
  checklistIntro:
    'This is a general checklist. Ask the official office to confirm what they need today.',
  draftNote: 'DRAFT for your review. Fill the [PLACEHOLDER] parts yourself.',
  greeting: 'Respected Sir/Madam,',
  subjectPrefix: 'Request regarding',
  iWork: 'I work with {platform}.',
  onDate: 'The issue relates to {date}.',
  amountLine: 'The amount involved is ₹{amount}.',
  whatHappenedLead: 'What happened, in my words:',
  tried: 'What I have already tried:',
  evidence: 'I can share: {items}.',
  requestLead: 'My request:',
  requestDefault: 'Please look into this and let me know the outcome.',
  thanks: 'Thank you for your time.',
  regards: 'Regards,',
  type_payment_delay: 'delayed or missing payment',
  type_incorrect_deduction: 'incorrect deduction',
  type_unpaid_incentive: 'unpaid incentive',
  type_account_suspension: 'account suspension',
  type_harassment: 'harassment at work',
  type_accident: 'accident at work',
  type_other: 'work-related issue',
};

const hi: Dict = {
  chatIntro: 'भरोसेमंद स्रोतों के अनुसार जानकारी यह है:',
  steps: 'आप यह कर सकते हैं:',
  verify: 'कृपया नीचे दिए आधिकारिक लिंक पर पुष्टि करें। नियम बदल सकते हैं।',
  noSources:
    'मैं इसे अपने भरोसेमंद स्रोतों से सत्यापित नहीं कर पाया, इसलिए अंदाज़ा नहीं लगाऊँगा। क्या आप थोड़ा और बताएँगे (आपका राज्य और काम का प्रकार)?',
  q_state: 'आप किस राज्य में हैं?',
  q_work: 'आप किस प्लेटफ़ॉर्म पर या कौन सा काम करते हैं?',
  earningsLine:
    'आपकी दर्ज की गई एंट्री के अनुसार इस {period} में: कुल कमाई ₹{gross}, खर्च ₹{expenses}, कटौती ₹{deductions}, यानी {hours} घंटे के लिए शुद्ध कमाई ₹{net}।',
  earningsNone: 'इस अवधि की कोई कमाई अभी दर्ज नहीं है। कमाई टैब में आज की कमाई जोड़ें।',
  explainNet:
    'शुद्ध कमाई = कुल कमाई − खर्च − कटौती। इस {period} में: कुल ₹{gross}, खर्च ₹{expenses}, कटौती ₹{deductions}, यानी शुद्ध ₹{net}।',
  explainBiggest: 'आपका सबसे बड़ा खर्च {item} था (₹{amount})।',
  explainFlag: 'कृपया {date} दोबारा जाँचें: {detail}।',
  explainTip: 'हर दिन पेट्रोल और दूसरे खर्च लिखें ताकि शुद्ध कमाई सही दिखे।',
  schemeIntro:
    'ये योजनाएँ आपके लिए प्रासंगिक हो सकती हैं। पात्रता केवल आधिकारिक पोर्टल बता सकता है।',
  schemeWhy: 'प्रासंगिक हो सकती है: {reason}',
  schemeNext: 'अगला कदम: आधिकारिक लिंक खोलें और शर्तें जाँचें।',
  schemeNone: 'मेरी सत्यापित सूची में कोई मेल खाती योजना नहीं मिली। अपने जवाब बदलकर देखें।',
  schemeUncertain:
    'संभावित रूप से प्रासंगिक — पात्रता जाँचें। हम यह नहीं कह सकते कि योजना अभी खुली है या नहीं।',
  checklistIntro: 'यह एक सामान्य सूची है। संबंधित कार्यालय से पूछ लें कि आज उन्हें क्या चाहिए।',
  draftNote: 'यह आपकी समीक्षा के लिए मसौदा है। [PLACEHOLDER] वाले हिस्से खुद भरें।',
  greeting: 'आदरणीय महोदय/महोदया,',
  subjectPrefix: 'निवेदन:',
  iWork: 'मैं {platform} के साथ काम करता/करती हूँ।',
  onDate: 'यह मामला {date} का है।',
  amountLine: 'संबंधित राशि ₹{amount} है।',
  whatHappenedLead: 'मेरे शब्दों में क्या हुआ:',
  tried: 'मैं पहले यह कोशिश कर चुका/चुकी हूँ:',
  evidence: 'मैं ये दे सकता/सकती हूँ: {items}।',
  requestLead: 'मेरा अनुरोध:',
  requestDefault: 'कृपया इस पर ध्यान दें और मुझे नतीजे की जानकारी दें।',
  thanks: 'आपके समय के लिए धन्यवाद।',
  regards: 'सादर,',
  type_payment_delay: 'देरी से या न मिला भुगतान',
  type_incorrect_deduction: 'गलत कटौती',
  type_unpaid_incentive: 'न मिला इंसेंटिव',
  type_account_suspension: 'खाता निलंबन',
  type_harassment: 'काम पर उत्पीड़न',
  type_accident: 'काम पर दुर्घटना',
  type_other: 'काम से जुड़ी समस्या',
};

const pa: Dict = {
  chatIntro: 'ਭਰੋਸੇਯੋਗ ਸਰੋਤਾਂ ਅਨੁਸਾਰ ਜਾਣਕਾਰੀ ਇਹ ਹੈ:',
  steps: 'ਤੁਸੀਂ ਇਹ ਕਰ ਸਕਦੇ ਹੋ:',
  verify: 'ਕਿਰਪਾ ਕਰਕੇ ਹੇਠਾਂ ਦਿੱਤੇ ਅਧਿਕਾਰਤ ਲਿੰਕ ਤੇ ਪੁਸ਼ਟੀ ਕਰੋ। ਨਿਯਮ ਬਦਲ ਸਕਦੇ ਹਨ।',
  noSources:
    'ਮੈਂ ਇਹ ਆਪਣੇ ਭਰੋਸੇਯੋਗ ਸਰੋਤਾਂ ਤੋਂ ਪੁਸ਼ਟੀ ਨਹੀਂ ਕਰ ਸਕਿਆ, ਇਸ ਲਈ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਗਾਵਾਂਗਾ। ਕੀ ਤੁਸੀਂ ਥੋੜ੍ਹਾ ਹੋਰ ਦੱਸੋਗੇ (ਤੁਹਾਡਾ ਰਾਜ ਅਤੇ ਕੰਮ ਦੀ ਕਿਸਮ)?',
  q_state: 'ਤੁਸੀਂ ਕਿਸ ਰਾਜ ਵਿੱਚ ਹੋ?',
  q_work: 'ਤੁਸੀਂ ਕਿਹੜੇ ਪਲੇਟਫਾਰਮ ਤੇ ਜਾਂ ਕਿਹੜਾ ਕੰਮ ਕਰਦੇ ਹੋ?',
  earningsLine:
    'ਤੁਹਾਡੀਆਂ ਦਰਜ ਕੀਤੀਆਂ ਐਂਟਰੀਆਂ ਅਨੁਸਾਰ ਇਸ {period} ਵਿੱਚ: ਕੁੱਲ ਕਮਾਈ ₹{gross}, ਖਰਚਾ ₹{expenses}, ਕਟੌਤੀ ₹{deductions}, ਯਾਨੀ {hours} ਘੰਟਿਆਂ ਦੀ ਸ਼ੁੱਧ ਕਮਾਈ ₹{net}।',
  earningsNone: 'ਇਸ ਸਮੇਂ ਦੀ ਕੋਈ ਕਮਾਈ ਹਾਲੇ ਦਰਜ ਨਹੀਂ ਹੈ। ਕਮਾਈ ਟੈਬ ਵਿੱਚ ਅੱਜ ਦੀ ਕਮਾਈ ਜੋੜੋ।',
  explainNet:
    'ਸ਼ੁੱਧ ਕਮਾਈ = ਕੁੱਲ ਕਮਾਈ − ਖਰਚਾ − ਕਟੌਤੀ। ਇਸ {period} ਵਿੱਚ: ਕੁੱਲ ₹{gross}, ਖਰਚਾ ₹{expenses}, ਕਟੌਤੀ ₹{deductions}, ਯਾਨੀ ਸ਼ੁੱਧ ₹{net}।',
  explainBiggest: 'ਤੁਹਾਡਾ ਸਭ ਤੋਂ ਵੱਡਾ ਖਰਚਾ {item} ਸੀ (₹{amount})।',
  explainFlag: 'ਕਿਰਪਾ ਕਰਕੇ {date} ਦੁਬਾਰਾ ਜਾਂਚੋ: {detail}।',
  explainTip: 'ਹਰ ਰੋਜ਼ ਪੈਟਰੋਲ ਅਤੇ ਹੋਰ ਖਰਚੇ ਲਿਖੋ ਤਾਂ ਜੋ ਸ਼ੁੱਧ ਕਮਾਈ ਸਹੀ ਦਿਸੇ।',
  schemeIntro: 'ਇਹ ਯੋਜਨਾਵਾਂ ਤੁਹਾਡੇ ਲਈ ਢੁਕਵੀਆਂ ਹੋ ਸਕਦੀਆਂ ਹਨ। ਯੋਗਤਾ ਸਿਰਫ਼ ਅਧਿਕਾਰਤ ਪੋਰਟਲ ਦੱਸ ਸਕਦਾ ਹੈ।',
  schemeWhy: 'ਢੁਕਵੀਂ ਹੋ ਸਕਦੀ ਹੈ: {reason}',
  schemeNext: 'ਅਗਲਾ ਕਦਮ: ਅਧਿਕਾਰਤ ਲਿੰਕ ਖੋਲ੍ਹੋ ਅਤੇ ਸ਼ਰਤਾਂ ਜਾਂਚੋ।',
  schemeNone: 'ਮੇਰੀ ਪੁਸ਼ਟੀ ਕੀਤੀ ਸੂਚੀ ਵਿੱਚ ਕੋਈ ਮੇਲ ਖਾਂਦੀ ਯੋਜਨਾ ਨਹੀਂ ਮਿਲੀ। ਆਪਣੇ ਜਵਾਬ ਬਦਲ ਕੇ ਵੇਖੋ।',
  schemeUncertain:
    'ਸੰਭਾਵੀ ਤੌਰ ਤੇ ਢੁਕਵੀਂ — ਯੋਗਤਾ ਜਾਂਚੋ। ਅਸੀਂ ਇਹ ਨਹੀਂ ਕਹਿ ਸਕਦੇ ਕਿ ਯੋਜਨਾ ਹੁਣ ਖੁੱਲ੍ਹੀ ਹੈ ਜਾਂ ਨਹੀਂ।',
  checklistIntro: 'ਇਹ ਇੱਕ ਆਮ ਸੂਚੀ ਹੈ। ਸਬੰਧਤ ਦਫ਼ਤਰ ਤੋਂ ਪੁੱਛ ਲਵੋ ਕਿ ਅੱਜ ਉਹਨਾਂ ਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ।',
  draftNote: 'ਇਹ ਤੁਹਾਡੀ ਸਮੀਖਿਆ ਲਈ ਖਰੜਾ ਹੈ। [PLACEHOLDER] ਵਾਲੇ ਹਿੱਸੇ ਆਪ ਭਰੋ।',
  greeting: 'ਸਤਿਕਾਰਯੋਗ ਸਰ/ਮੈਡਮ,',
  subjectPrefix: 'ਬੇਨਤੀ:',
  iWork: 'ਮੈਂ {platform} ਨਾਲ ਕੰਮ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ।',
  onDate: 'ਇਹ ਮਾਮਲਾ {date} ਦਾ ਹੈ।',
  amountLine: 'ਸਬੰਧਤ ਰਕਮ ₹{amount} ਹੈ।',
  whatHappenedLead: 'ਮੇਰੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਕੀ ਹੋਇਆ:',
  tried: 'ਮੈਂ ਪਹਿਲਾਂ ਇਹ ਕੋਸ਼ਿਸ਼ ਕਰ ਚੁੱਕਾ/ਚੁੱਕੀ ਹਾਂ:',
  evidence: 'ਮੈਂ ਇਹ ਦੇ ਸਕਦਾ/ਸਕਦੀ ਹਾਂ: {items}।',
  requestLead: 'ਮੇਰੀ ਬੇਨਤੀ:',
  requestDefault: 'ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਵੱਲ ਧਿਆਨ ਦਿਓ ਅਤੇ ਮੈਨੂੰ ਨਤੀਜੇ ਬਾਰੇ ਦੱਸੋ।',
  thanks: 'ਤੁਹਾਡੇ ਸਮੇਂ ਲਈ ਧੰਨਵਾਦ।',
  regards: 'ਸਤਿਕਾਰ ਸਹਿਤ,',
  type_payment_delay: 'ਦੇਰੀ ਨਾਲ ਜਾਂ ਨਾ ਮਿਲੀ ਅਦਾਇਗੀ',
  type_incorrect_deduction: 'ਗਲਤ ਕਟੌਤੀ',
  type_unpaid_incentive: 'ਨਾ ਮਿਲਿਆ ਇੰਸੈਂਟਿਵ',
  type_account_suspension: 'ਖਾਤਾ ਮੁਅੱਤਲ',
  type_harassment: 'ਕੰਮ ਤੇ ਪਰੇਸ਼ਾਨੀ',
  type_accident: 'ਕੰਮ ਤੇ ਹਾਦਸਾ',
  type_other: 'ਕੰਮ ਨਾਲ ਜੁੜੀ ਸਮੱਸਿਆ',
};

const bn: Dict = {
  chatIntro: 'নির্ভরযোগ্য উৎস অনুযায়ী তথ্য:',
  steps: 'আপনি যা করতে পারেন:',
  verify: 'অনুগ্রহ করে নিচের সরকারি লিঙ্কে যাচাই করুন। নিয়ম বদলাতে পারে।',
  noSources:
    'আমি এটি আমার নির্ভরযোগ্য উৎস থেকে যাচাই করতে পারিনি, তাই অনুমান করব না। আপনার রাজ্য ও কাজের ধরন বলবেন?',
  q_state: 'আপনি কোন রাজ্যে আছেন?',
  q_work: 'আপনি কোন প্ল্যাটফর্মে বা কী কাজ করেন?',
};
const ta: Dict = {
  chatIntro: 'நம்பகமான ஆதாரங்களின்படி தகவல்:',
  steps: 'நீங்கள் செய்யக்கூடியது:',
  verify: 'கீழே உள்ள அதிகாரப்பூர்வ இணைப்பில் உறுதிப்படுத்தவும். விதிகள் மாறலாம்.',
  noSources:
    'இதை எனது நம்பகமான ஆதாரங்களில் சரிபார்க்க முடியவில்லை, எனவே ஊகிக்க மாட்டேன். உங்கள் மாநிலம் மற்றும் வேலை வகையை சொல்ல முடியுமா?',
  q_state: 'நீங்கள் எந்த மாநிலத்தில் இருக்கிறீர்கள்?',
  q_work: 'எந்த தளத்தில் அல்லது என்ன வேலை செய்கிறீர்கள்?',
};
const te: Dict = {
  chatIntro: 'నమ్మదగిన వనరుల ప్రకారం సమాచారం:',
  steps: 'మీరు చేయగలిగేవి:',
  verify: 'దయచేసి క్రింది అధికారిక లింక్‌లో నిర్ధారించుకోండి. నియమాలు మారవచ్చు.',
  noSources:
    'దీన్ని నా నమ్మదగిన వనరుల నుండి ధృవీకరించలేకపోయాను, కాబట్టి ఊహించను. మీ రాష్ట్రం మరియు పని రకం చెప్పగలరా?',
  q_state: 'మీరు ఏ రాష్ట్రంలో ఉన్నారు?',
  q_work: 'మీరు ఏ ప్లాట్‌ఫాంలో లేదా ఏ పని చేస్తారు?',
};
const mr: Dict = {
  chatIntro: 'विश्वासार्ह स्रोतांनुसार माहिती:',
  steps: 'तुम्ही हे करू शकता:',
  verify: 'कृपया खालील अधिकृत लिंकवर खात्री करा. नियम बदलू शकतात.',
  noSources:
    'मी हे माझ्या विश्वासार्ह स्रोतांमधून पडताळू शकलो नाही, म्हणून अंदाज लावणार नाही. तुमचे राज्य आणि कामाचा प्रकार सांगाल का?',
  q_state: 'तुम्ही कोणत्या राज्यात आहात?',
  q_work: 'तुम्ही कोणत्या प्लॅटफॉर्मवर किंवा कोणते काम करता?',
};

const TABLE: Partial<Record<Language, Dict>> = { en, hi, pa, bn, ta, te, mr };

export function t(lang: Language, key: string, vars: Record<string, string | number> = {}): string {
  const raw = TABLE[lang]?.[key] ?? en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export const PERIOD_WORD: Record<'day' | 'week' | 'month', Partial<Record<Language, string>>> = {
  day: { en: 'day', hi: 'दिन', pa: 'ਦਿਨ' },
  week: { en: 'week', hi: 'सप्ताह', pa: 'ਹਫ਼ਤੇ' },
  month: { en: 'month', hi: 'महीने', pa: 'ਮਹੀਨੇ' },
};
export const periodWord = (p: 'day' | 'week' | 'month', l: Language) =>
  PERIOD_WORD[p][l] ?? PERIOD_WORD[p].en!;
