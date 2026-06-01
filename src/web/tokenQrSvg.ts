import qrcode from "qrcode-generator";

const STANDALONE_QR_SIZE = 360;
const EMBEDDED_QR_WIDTH_RATIO = 0.18;
const MIN_EMBEDDED_QR_SIZE = 280;
const MAX_EMBEDDED_QR_SIZE = 420;
const QR_MARGIN = 36;
const QUIET_MODULES = 4;
const ERROR_CORRECTION_LEVEL = "M";
const DEFAULT_SCAN_BASE_URL = "https://nomai.uk/";

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function readViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const svgTag = svg.match(/^<svg\b([^>]*)>/i);
  const viewBox = svgTag?.[1].match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  if (!viewBox) return null;

  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;

  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

export function buildNomaiTokenScanUrl(tokenStream: string, baseUrl = DEFAULT_SCAN_BASE_URL): string {
  const url = new URL(baseUrl);
  url.hash = `nomai=${tokenStream}`;
  return url.toString();
}

function createQrRects(payload: string, size: number): { moduleCount: number; rects: string } {
  const qr = qrcode(0, ERROR_CORRECTION_LEVEL);
  qr.addData(payload, "Byte");
  qr.make();

  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + QUIET_MODULES * 2;
  const cellSize = size / totalModules;
  const rects: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      rects.push(
        `<rect x="${fmt((col + QUIET_MODULES) * cellSize)}" y="${fmt((row + QUIET_MODULES) * cellSize)}" width="${fmt(cellSize)}" height="${fmt(cellSize)}"/>`
      );
    }
  }

  return { moduleCount, rects: rects.join("") };
}

function createQrLayer(tokenStream: string, x: number, y: number, size: number): string {
  const scanUrl = buildNomaiTokenScanUrl(tokenStream);
  const { moduleCount, rects } = createQrRects(scanUrl, size);

  return [
    `<g id="nomai-token-qr" data-nomai-qr-token="true" data-nomai-qr-kind="scan-url" data-nomai-qr-placement="bottom-right" data-nomai-qr-error-correction="${ERROR_CORRECTION_LEVEL}" data-nomai-qr-modules="${moduleCount}" data-nomai-qr-payload="${escapeXmlAttribute(tokenStream)}" data-nomai-qr-scan-url="${escapeXmlAttribute(scanUrl)}" role="img" aria-label="NOMAI1 token QR" transform="translate(${fmt(x)} ${fmt(y)})">`,
    `<rect x="-18" y="-18" width="${fmt(size + 36)}" height="${fmt(size + 36)}" rx="10" fill="#ffffff" stroke="#104e8b" stroke-width="4"/>`,
    `<rect width="${fmt(size)}" height="${fmt(size)}" fill="#ffffff"/>`,
    `<g fill="#000000">${rects}</g>`,
    `</g>`
  ].join("\n");
}

export function buildNomaiTokenQrSvg(tokenStream: string): string {
  const scanUrl = buildNomaiTokenScanUrl(tokenStream);
  const { moduleCount, rects } = createQrRects(scanUrl, STANDALONE_QR_SIZE);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NOMAI1 token QR" viewBox="0 0 ${STANDALONE_QR_SIZE} ${STANDALONE_QR_SIZE}" width="${STANDALONE_QR_SIZE}" height="${STANDALONE_QR_SIZE}" shape-rendering="crispEdges" data-nomai-qr-token="true" data-nomai-qr-kind="scan-url" data-nomai-qr-error-correction="${ERROR_CORRECTION_LEVEL}" data-nomai-qr-modules="${moduleCount}" data-nomai-qr-payload="${escapeXmlAttribute(tokenStream)}" data-nomai-qr-scan-url="${escapeXmlAttribute(scanUrl)}">`,
    `<rect width="${STANDALONE_QR_SIZE}" height="${STANDALONE_QR_SIZE}" fill="#ffffff"/>`,
    `<g fill="#000000">${rects}</g>`,
    `</svg>`
  ].join("\n");
}

export function embedTokenQrSvg(svg: string, tokenStream: string): string {
  const viewBox = readViewBox(svg);
  if (!viewBox) return svg;

  const availableSize = Math.max(120, Math.min(viewBox.width, viewBox.height) - QR_MARGIN * 2);
  const targetSize = Math.max(MIN_EMBEDDED_QR_SIZE, viewBox.width * EMBEDDED_QR_WIDTH_RATIO);
  const qrSize = Math.min(MAX_EMBEDDED_QR_SIZE, targetSize, availableSize);
  const x = viewBox.x + viewBox.width - qrSize - QR_MARGIN;
  const y = viewBox.y + viewBox.height - qrSize - QR_MARGIN;
  const qrLayer = createQrLayer(tokenStream, x, y, qrSize);

  return svg.replace(/<\/svg>\s*$/i, `${qrLayer}\n</svg>`);
}
