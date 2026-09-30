import React from "react";

/**
 * Крошечный безопасный рендер Markdown для статей справки.
 *
 * Внешних зависимостей нет, HTML не вставляем — собираем React-узлы, поэтому
 * инъекции невозможны. Поддержано ровно то, что нужно статьям: заголовки
 * (#, ##), списки (- / *), нумерованные списки (1.), абзацы и строчное
 * оформление — **жирный**, `код`, [ссылка](url).
 */

/** Строчное оформление одной строки: **жирный**, `код`, [текст](url). */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Порядок важен: код первым, чтобы * и [ внутри `...` не толковались.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[0.85em] text-fg">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const label = token.slice(1, token.indexOf("]"));
      const href = token.slice(token.indexOf("(") + 1, -1);
      const external = href.startsWith("http");
      nodes.push(
        <a
          key={`${keyBase}-l${i}`}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="text-accent hover:underline"
        >
          {label}
        </a>,
      );
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={`p${key++}`} className="text-sm leading-relaxed text-fg-muted">
        {renderInline(para.join(" "), `p${key}`)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const cls = "my-1 space-y-1 pl-5 text-sm leading-relaxed text-fg-muted " + (ordered ? "list-decimal" : "list-disc");
    blocks.push(
      ordered ? (
        <ol key={`l${key++}`} className={cls}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `l${key}-${idx}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l${key++}`} className={cls}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `l${key}-${idx}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const content = renderInline(h[2], `h${key}`);
      if (level === 1) {
        blocks.push(<h2 key={`h${key++}`} className="mt-5 mb-2 text-lg font-semibold text-fg first:mt-0">{content}</h2>);
      } else if (level === 2) {
        blocks.push(<h3 key={`h${key++}`} className="mt-4 mb-1.5 text-[15px] font-semibold text-fg first:mt-0">{content}</h3>);
      } else {
        blocks.push(<h4 key={`h${key++}`} className="mt-3 mb-1 text-sm font-semibold text-fg-muted first:mt-0">{content}</h4>);
      }
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      const item = (ul ? ul[1] : ol![1]).trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
