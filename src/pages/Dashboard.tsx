import { useEffect, useState } from "react";
import {
  listPublicWireframes,
  listMyWireframes,
  deleteWireframe,
} from "../api/wireframe.ts";
import { WireframeGrid } from "../components/dashboard/WireframeGrid";
import type { WireframeSummary } from "../components/dashboard/WireframeCard";
import dashboardHero from "../../assets/dashboardHero.png";
import filterIcon from "../../assets/filter.svg";

type Tab = "explore" | "mine";

const PAGE_SIZE = 24; // must match the range size used in api/wireframes.ts

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("explore");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<WireframeSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === query) return;
      setItems([]);
      setPage(0);
      setQuery(next);
    }, 300);
    return () => clearTimeout(t);
  }, [search, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetcher = tab === "mine" ? listMyWireframes : listPublicWireframes;
    fetcher(page, query)
      .then((rows: any) => {
        if (cancelled) return;
        const list = (rows ?? []) as unknown as WireframeSummary[];
        setItems((prev) => (page === 0 ? list : [...prev, ...list]));
        setHasMore(list.length === PAGE_SIZE);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to load wireframes.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, query, page]);

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    setItems([]);
    setPage(0);
    setTab(next);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWireframe(id);
      setItems((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to delete wireframe.";
      window.alert(message);
    }
  };

  return (
    <div className="dashboard-shell">
      <img
        src={dashboardHero}
        alt="Dashboard hero"
        className="dashboard-hero"
      />

      <div className="dashboard-controls">
        <div
          className="dashboard-tabs"
          role="tablist"
          aria-label="Wireframe tabs"
        >
          {(["explore", "mine"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeTab(t)}
              className={`dashboard-tab ${tab === t ? "active" : ""}`}
              aria-selected={tab === t}
            >
              {t === "explore" ? "Explore" : "Mine"}
            </button>
          ))}
        </div>

        <div className="dashboard-search-row">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="dashboard-search-input"
          />

          <button type="button" className="dashboard-filter-button">
            <span>Filter</span>
            <img src={filterIcon} alt="Filter" />
          </button>
        </div>
      </div>

      {error && <p className="dashboard-error">{error}</p>}

      <div className="dashboard-grid-wrap">
        <WireframeGrid
          wireframes={items}
          loading={loading}
          editable={tab === "mine"}
          onDelete={tab === "mine" ? handleDelete : undefined}
          emptyMessage={
            error
              ? ""
              : tab === "mine"
                ? "You haven't created any wireframes yet."
                : "No public wireframes match your search."
          }
        />
      </div>

      {hasMore && (
        <div className="dashboard-load-more">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="dashboard-load-more-button"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
