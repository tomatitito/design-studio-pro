import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Asset } from "../types";

type ViewMode = "grid" | "list";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Asset[]>("list_assets");
      setAssets(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleDelete = async (assetId: string) => {
    try {
      await invoke("delete_asset", { assetId });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(String(err));
    }
  };

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalSize = assets.reduce((sum, a) => sum + a.fileSize, 0);

  return (
    <div
      className="flex h-full flex-col"
      data-testid="asset-library"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2">
        <span className="text-xs text-neutral-400">
          {assets.length} assets ({formatFileSize(totalSize)})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded px-2 py-1 text-xs ${
              viewMode === "grid"
                ? "bg-neutral-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Grid view"
            data-testid="view-grid"
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded px-2 py-1 text-xs ${
              viewMode === "list"
                ? "bg-neutral-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
            title="List view"
            data-testid="view-list"
          >
            List
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-neutral-700 px-3 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search assets..."
          className="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
          data-testid="asset-search"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-4">
            <span className="text-xs text-neutral-400">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-3">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={loadAssets}
              className="mt-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredAssets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-6">
            <span className="text-xs text-neutral-500">
              {searchQuery ? "No matching assets" : "No assets imported"}
            </span>
          </div>
        )}

        {!loading && !error && filteredAssets.length > 0 && viewMode === "grid" && (
          <div
            className="grid grid-cols-3 gap-1 p-2"
            data-testid="asset-grid"
          >
            {filteredAssets.map((asset) => (
              <AssetGridItem
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {!loading && !error && filteredAssets.length > 0 && viewMode === "list" && (
          <div
            className="flex flex-col"
            data-testid="asset-list"
          >
            {filteredAssets.map((asset) => (
              <AssetListItem
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AssetItemProps {
  asset: Asset;
  onDelete: (id: string) => void;
}

function AssetGridItem({ asset, onDelete }: AssetItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const thumbnailSrc = asset.thumbnailPath
    ? convertFileSrc(asset.thumbnailPath)
    : null;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded border border-neutral-700 bg-neutral-800 hover:border-neutral-500"
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onMouseLeave={() => setShowMenu(false)}
      data-testid={`asset-item-${asset.id}`}
    >
      <div className="flex aspect-square items-center justify-center bg-neutral-900">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={asset.name}
            className="h-full w-full object-contain"
            draggable
          />
        ) : (
          <span className="text-lg text-neutral-600">
            {asset.name.split(".").pop()?.toUpperCase() || "?"}
          </span>
        )}
      </div>
      <div className="truncate px-1 py-0.5 text-center text-[10px] text-neutral-400">
        {asset.name}
      </div>

      {showMenu && (
        <ContextMenu
          onDelete={() => {
            onDelete(asset.id);
            setShowMenu(false);
          }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

function AssetListItem({ asset, onDelete }: AssetItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const thumbnailSrc = asset.thumbnailPath
    ? convertFileSrc(asset.thumbnailPath)
    : null;

  const dimensionsText = asset.dimensions
    ? `${asset.dimensions.width} x ${asset.dimensions.height}`
    : "--";

  return (
    <div
      className="group relative flex items-center gap-2 border-b border-neutral-700 px-3 py-2 hover:bg-neutral-750"
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onMouseLeave={() => setShowMenu(false)}
      data-testid={`asset-item-${asset.id}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-900">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={asset.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-[10px] text-neutral-600">
            {asset.name.split(".").pop()?.toUpperCase() || "?"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-neutral-200">{asset.name}</div>
        <div className="text-[10px] text-neutral-500">
          {dimensionsText} &middot; {formatFileSize(asset.fileSize)}
        </div>
      </div>

      {showMenu && (
        <ContextMenu
          onDelete={() => {
            onDelete(asset.id);
            setShowMenu(false);
          }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

interface ContextMenuProps {
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ onDelete, onClose }: ContextMenuProps) {
  return (
    <div
      className="absolute right-0 top-0 z-10 rounded border border-neutral-600 bg-neutral-800 py-1 shadow-lg"
      data-testid="asset-context-menu"
    >
      <button
        onClick={onDelete}
        className="block w-full px-3 py-1 text-left text-xs text-red-400 hover:bg-neutral-700"
      >
        Delete
      </button>
      <button
        onClick={onClose}
        className="block w-full px-3 py-1 text-left text-xs text-neutral-300 hover:bg-neutral-700"
      >
        Cancel
      </button>
    </div>
  );
}
