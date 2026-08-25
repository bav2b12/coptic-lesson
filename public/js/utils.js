// DOROS COPTIC — UTILITIES & COPTIC LANGUAGE DATA

const COPTIC_ALPHABET = [
  { char: 'Ⲁ ⲁ', name_ar: 'ألفا', name_en: 'Alpha', sound: 'ينطق دائماً (أ) مثل: Ⲁⲛⲟⲕ (أنا)' },
  { char: 'Ⲃ ⲃ', name_ar: 'ڤيتا', name_en: 'Vita', sound: 'ينطق (ڤ) بعده متحرك، و(ب) فيما عدا ذلك' },
  { char: 'Ⲅ ⲅ', name_ar: 'غما', name_en: 'Ghamma', sound: 'ينطق (ج) أو (ن) أو (غ) حسب الحرف التالي' },
  { char: 'Ⲇ ⲇ', name_ar: 'دلدا', name_en: 'Dalda', sound: 'ينطق (د) في الأعلام، و(ذ) في اليوناني' },
  { char: 'Ⲉ ⲉ', name_ar: 'إي', name_en: 'Ei', sound: 'حرف متحرك للفتح الخفيف (إِ)' },
  { char: 'Ⲋ ⲋ', name_ar: 'سو', name_en: 'Soou', sound: 'رقم 6' },
  { char: 'Ⲍ ⲍ', name_ar: 'زيتا', name_en: 'Zita', sound: 'ينطق (ز)' },
  { char: 'Ⲏ ⲏ', name_ar: 'إيتا', name_en: 'Hita', sound: 'ياء طويلة (إيي)' },
  { char: 'Ⲑ ⲑ', name_ar: 'ثيتا', name_en: 'Thita', sound: 'ينطق (ث) أو (ت) بعد Ⲥ و Ϣ' },
  { char: 'Ⲓ ⲓ', name_ar: 'يوطا', name_en: 'Iota', sound: 'ياء قصيرة' },
  { char: 'Ⲕ ⲕ', name_ar: 'كابا', name_en: 'Kappa', sound: 'ينطق (ك)' },
  { char: 'Ⲗ ⲗ', name_ar: 'لافلا', name_en: 'Laula', sound: 'ينطق (ل)' },
  { char: 'Ⲙ ⲙ', name_ar: 'مي', name_en: 'Mei', sound: 'ينطق (م)' },
  { char: 'Ⲛ ⲛ', name_ar: 'ني', name_en: 'Nei', sound: 'ينطق (ن)' },
  { char: 'Ⲝ ⲝ', name_ar: 'إكسي', name_en: 'Exi', sound: 'ينطق (ك + س)' },
  { char: 'Ⲟ ⲟ', name_ar: 'أو', name_en: 'O', sound: 'واو قصيرة (ضمة)' },
  { char: 'Ⲡ ⲡ', name_ar: 'بي', name_en: 'Pi', sound: 'ينطق (ب)' },
  { char: 'Ⲣ ⲣ', name_ar: 'رو', name_en: 'Ro', sound: 'ينطق (ر)' },
  { char: 'Ⲥ ⲥ', name_ar: 'سيما', name_en: 'Sima', sound: 'ينطق (س) أو (ز)' },
  { char: 'Ⲧ ⲧ', name_ar: 'تاڤ', name_en: 'Tav', sound: 'ينطق (ت) أو (د)' },
  { char: 'Ⲩ ⲩ', name_ar: 'إپسلون', name_en: 'Upsilon', sound: 'ينطق (ڤ) أو (و) أو (ي)' },
  { char: 'Ⲫ ⲫ', name_ar: 'في', name_en: 'Phi', sound: 'ينطق (ف)' },
  { char: 'Ⲭ ⲭ', name_ar: 'كي', name_en: 'Chi', sound: 'ينطق (ك) أو (ش) أو (خ)' },
  { char: 'Ⲯ ⲯ', name_ar: 'إبسي', name_en: 'Psi', sound: 'ينطق (ب + س)' },
  { char: 'Ⲱ ⲱ', name_ar: 'أوميجا', name_en: 'Omega', sound: 'واو طويلة (أوو)' },
  { char: 'Ϣ ϣ', name_ar: 'شاي', name_en: 'Shai', sound: 'ينطق (ش) - ديموطيقي' },
  { char: 'Ϥ ϥ', name_ar: 'فاي', name_en: 'Fai', sound: 'ينطق (ف) - ديموطيقي' },
  { char: 'Ϧ ϧ', name_ar: 'خاي', name_en: 'Khai', sound: 'ينطق (خ) - ديموطيقي' },
  { char: 'Ϩ ϩ', name_ar: 'هوري', name_en: 'Hori', sound: 'ينطق (هـ) - ديموطيقي' },
  { char: 'Ϫ ϫ', name_ar: 'جانجا', name_en: 'Janja', sound: 'ينطق (ج) أو (چ) - ديموطيقي' },
  { char: 'Ϭ ϭ', name_ar: 'تشيما', name_en: 'Chima', sound: 'ينطق (تش) - ديموطيقي' },
  { char: 'Ϯ ϯ', name_ar: 'تي', name_en: 'Ti', sound: 'ينطق (تي) - ديموطيقي' }
];

const utils = {
  formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(window.i18n.getLang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString(window.i18n.getLang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  copticAlphabet: COPTIC_ALPHABET
};

window.utils = utils;
