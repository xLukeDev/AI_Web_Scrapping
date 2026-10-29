import * as cheerio from "cheerio";

// Atrybuty, które niosą znaczenie dla modelu: pełny tytuł (title, alt) i ocenę (class)
const KEEP_ATTRS = new Set(["title", "alt", "class"]);

// Czyści HTML przed wysłaniem do modelu. Model płaci za każdy token,
// więc wyrzucamy wszystko, co nie niesie danych: mniej tokenów = niższy koszt i mniej szumu.
export function cleanHtml(html: string, rootSelector = "body"): string {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, iframe, nav, header, footer, form, link, meta, i").remove();

  $("*").each((_, el) => {
    if (!("attribs" in el)) return;
    for (const name of Object.keys(el.attribs)) {
      if (!KEEP_ATTRS.has(name)) $(el).removeAttr(name);
    }
  });

  const root = $(rootSelector).first();
  const fragment = root.length ? root.html() : $("body").html();
  return (fragment ?? "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
}

// Przybliżona liczba tokenów (ok. 4 znaki na token dla HTML po angielsku)
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
