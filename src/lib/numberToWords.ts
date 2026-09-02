/**
 * Сумма прописью для печатных форм и шаблонов документов.
 *
 * Вынесена из invoice-pdf: тот модуль клиентский (html2canvas, jsPDF),
 * а пропись нужна и на сервере — для подстановки в DOCX-бланки.
 */
// Сумма прописью (рубли/копейки)
const ones  = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const onesF = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять","десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const tens = ["","десять","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
const hundreds = ["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];

function threeDigits(n: number, feminine = false): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(hundreds[h]);
  if (t === 1) { parts.push((feminine ? onesF : ones)[10 + o]); }
  else { if (t) parts.push(tens[t]); if (o) parts.push((feminine ? onesF : ones)[o]); }
  return parts.join(" ");
}

function numWord(n: number, one: string, two: string, five: string): string {
  const abs = Math.abs(n) % 100, mod10 = abs % 10;
  if (abs >= 11 && abs <= 19) return five;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

export function numberToWords(amount: number): string {
  const rubles = Math.floor(amount);
  const kopecks = Math.round((amount - rubles) * 100);
  const billions = Math.floor(rubles / 1_000_000_000);
  const millions = Math.floor((rubles % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1_000);
  const remainder = rubles % 1_000;
  const parts: string[] = [];
  if (billions)  { parts.push(threeDigits(billions));       parts.push(numWord(billions,  "миллиард",  "миллиарда",  "миллиардов")); }
  if (millions)  { parts.push(threeDigits(millions));       parts.push(numWord(millions,  "миллион",   "миллиона",   "миллионов")); }
  if (thousands) { parts.push(threeDigits(thousands, true)); parts.push(numWord(thousands, "тысяча",    "тысячи",     "тысяч")); }
  if (remainder || rubles === 0) parts.push(threeDigits(remainder));
  const rublesStr = parts.filter(Boolean).join(" ") || "ноль";
  const rublesWord = numWord(remainder === 0 ? rubles : remainder, "рубль", "рубля", "рублей");
  const kopecksStr = kopecks.toString().padStart(2, "0");
  const kopecksWord = numWord(kopecks, "копейка", "копейки", "копеек");
  return (rublesStr.charAt(0).toUpperCase() + rublesStr.slice(1)) + ` ${rublesWord} ${kopecksStr} ${kopecksWord}`;
}
