import type { WireframeDoc } from "../api/wireframe";
import { anchorPoint } from "./geometry";
import { supabase } from "./supabase";

function resolvePoint(
  doc: WireframeDoc,
  end: { x: number; y: number; elementId?: string; side?: string },
): { x: number; y: number } {
  if (end.elementId && end.side) {
    const target = doc.elements[end.elementId];
    if (target) {
      return anchorPoint(
        target,
        end.side as "top" | "right" | "bottom" | "left",
      );
    }
  }

  return { x: end.x, y: end.y };
}

function getContentBounds(doc: WireframeDoc) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of doc.order) {
    const el = doc.elements[id];
    if (!el) continue;

    if (el.type === "arrow") {
      const start = resolvePoint(doc, el.start ?? { x: 0, y: 0 });
      const end = resolvePoint(doc, el.end ?? { x: 0, y: 0 });
      minX = Math.min(minX, start.x, end.x);
      minY = Math.min(minY, start.y, end.y);
      maxX = Math.max(maxX, start.x, end.x);
      maxY = Math.max(maxY, start.y, end.y);
      continue;
    }

    if (el.type === "line") {
      const points = el.points ?? [0, 0, el.width, el.height];
      for (let i = 0; i < points.length; i += 2) {
        const x = el.x + points[i];
        const y = el.y + points[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      continue;
    }

    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export async function uploadThumbnail(
  doc: WireframeDoc,
  wireframeId: string,
  ownerId: string,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  const width = 1000;
  const height = 750;
  const padding = 48;
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const bounds = getContentBounds(doc);
  const fitScale = Math.min(
    (width - padding * 2) / bounds.width,
    (height - padding * 2) / bounds.height,
  );
  const scale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
  const offsetX = padding - bounds.x * scale;
  const offsetY = padding - bounds.y * scale;

  const drawArrowhead = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    size: number,
  ) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - size * Math.cos(angle - Math.PI / 6),
      toY - size * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      toX - size * Math.cos(angle + Math.PI / 6),
      toY - size * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  };

  for (const id of doc.order) {
    const el = doc.elements[id];
    if (!el) continue;

    const x = el.x * scale + offsetX;
    const y = el.y * scale + offsetY;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((el.rotation ?? 0) * Math.PI) / 180);

    if (el.type === "rect" || el.type === "frame") {
      ctx.fillStyle = el.fill ?? "#ffffff";
      ctx.strokeStyle = el.stroke ?? "#111111";
      ctx.lineWidth = (el.strokeWidth ?? 2) * scale;
      ctx.fillRect(0, 0, el.width * scale, el.height * scale);
      ctx.strokeRect(0, 0, el.width * scale, el.height * scale);
    } else if (el.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        (el.width * scale) / 2,
        (el.height * scale) / 2,
        (el.width * scale) / 2,
        (el.height * scale) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = el.fill ?? "#ffffff";
      ctx.fill();
      ctx.strokeStyle = el.stroke ?? "#111111";
      ctx.lineWidth = (el.strokeWidth ?? 2) * scale;
      ctx.stroke();
    } else if (el.type === "line") {
      const points = el.points ?? [0, 0, el.width, el.height];
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 2) {
        const px = points[i] * scale;
        const py = points[i + 1] * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = el.stroke ?? "#111111";
      ctx.lineWidth = (el.strokeWidth ?? 2) * scale;
      ctx.stroke();
    } else if (el.type === "text") {
      ctx.fillStyle = el.fill ?? "#111111";
      ctx.font = `${(el.fontSize ?? 24) * scale}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(el.text ?? "", 0, 0, el.width * scale);
    } else if (el.type === "arrow") {
      const start = resolvePoint(doc, el.start ?? { x: 0, y: 0 });
      const end = resolvePoint(doc, el.end ?? { x: 0, y: 0 });
      const fromX = (start.x - el.x) * scale;
      const fromY = (start.y - el.y) * scale;
      const toX = (end.x - el.x) * scale;
      const toY = (end.y - el.y) * scale;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.strokeStyle = el.stroke ?? "#111111";
      ctx.lineWidth = (el.strokeWidth ?? 2) * scale;
      ctx.stroke();
      drawArrowhead(fromX, fromY, toX, toY, el.stroke ?? "#111111", 12 * scale);
    }

    ctx.restore();
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const blob = await (await fetch(dataUrl)).blob();

  const path = `${ownerId}/${wireframeId}.jpg`;
  const { error } = await supabase.storage
    .from("thumbnails")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
