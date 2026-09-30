"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Markdown } from "@/lib/markdown";
import { BookOpen, Search, Plus, Pencil, Trash2 } from "lucide-react";

interface Article {
  id: string;
  slug: string;
  category: string;
  title: string;
  body: string;
}

export default function HelpClient({
  initialArticles,
  isAdmin,
}: {
  initialArticles: Article[];
  isAdmin: boolean;
}) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialArticles[0]?.id ?? null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState({ title: "", category: "", body: "" });
  const [saving, setSaving] = useState(false);

  // Открытие по якорю /help#slug — из контекстных «?» на страницах.
  useEffect(() => {
    const slug = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!slug) return;
    const found = articles.find((a) => a.slug === slug);
    if (found) setSelectedId(found.id);
    // один раз на монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [articles, query]);

  // Группировка по категориям с сохранением порядка появления.
  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of filtered) {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selected = articles.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  function openNew() {
    setEditing(null);
    setForm({ title: "", category: selected?.category ?? "", body: "" });
    setModalOpen(true);
  }
  function openEdit(a: Article) {
    setEditing(a);
    setForm({ title: a.title, category: a.category, body: a.body });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editing ? `/api/help/${editing.id}` : "/api/help";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data: Article = await res.json();
      setArticles((prev) => {
        if (editing) return prev.map((a) => (a.id === data.id ? data : a));
        return [...prev, data];
      });
      setSelectedId(data.id);
      setModalOpen(false);
    } else {
      alert("Не удалось сохранить статью");
    }
    setSaving(false);
  }

  async function remove(a: Article) {
    if (!confirm(`Удалить статью «${a.title}»?`)) return;
    const res = await fetch(`/api/help/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      setArticles((prev) => prev.filter((x) => x.id !== a.id));
      if (selectedId === a.id) setSelectedId(null);
    } else {
      alert("Не удалось удалить статью");
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<BookOpen size={18} />}
        title="Справка"
        subtitle="Как что устроено в системе — коротко и по делу"
        actions={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus size={16} /> Новая статья
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[17rem_1fr] lg:items-start">
        {/* Список слева */}
        <Card padding="none" className="lg:sticky lg:top-4">
          <div className="border-b border-line-soft p-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по справке..."
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
              />
            </div>
          </div>
          <nav className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
            {grouped.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-fg-subtle">Ничего не найдено</p>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category}>
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                    {category}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={
                          "block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors " +
                          (selected?.id === a.id
                            ? "bg-accent-soft font-semibold text-accent-fg"
                            : "font-medium text-fg-muted hover:bg-surface-hover hover:text-fg")
                        }
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </nav>
        </Card>

        {/* Статья справа */}
        <Card padding="md">
          {selected ? (
            <article>
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-line-soft pb-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{selected.category}</p>
                  <h1 className="mt-0.5 text-xl font-semibold text-fg">{selected.title}</h1>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(selected)}
                      title="Редактировать"
                      className="rounded-lg p-2 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-accent"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(selected)}
                      title="Удалить"
                      className="rounded-lg p-2 text-fg-subtle transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <Markdown text={selected.body} />
            </article>
          ) : (
            <div className="py-16 text-center text-sm text-fg-subtle">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              Выберите статью слева
            </div>
          )}
        </Card>
      </div>

      {isAdmin && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "Редактировать статью" : "Новая статья"}
          size="xl"
        >
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Заголовок *"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Например: Как загрузить шаблон"
              />
              <Input
                label="Категория *"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Например: Документы"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Текст</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={14}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
                placeholder={"Поддерживается разметка:\n# Заголовок\n## Подзаголовок\n- пункт списка\n1. нумерованный пункт\n**жирный**, `код`, [ссылка](https://...)"}
              />
              <p className="mt-1 text-xs text-fg-subtle">
                Разметка: # заголовки, - списки, **жирный**, `код`, [ссылка](url).
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
