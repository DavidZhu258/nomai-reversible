import type { IScannerControls } from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { decodeNomaiImage, encodeToNomaiImage } from "./translationFlow";
import { extractNomaiTokenFromScan } from "./scanToken";
import "./styles.css";

type Language = "en" | "zh";

const UI = {
  en: {
    languageName: "English",
    switchLanguage: "中文",
    subtitle: "Text to spiral SVG, SVG/token/QR back to original text.",
    saveSvg: "Save SVG",
    decodeCurrent: "Decode Current",
    encode: "Encode",
    text: "Text",
    textPlaceholder: "Enter text in any language...",
    seed: "Seed",
    handwriting: "Handwriting",
    cameraQr: "Camera QR",
    copySvg: "Copy SVG",
    copyToken: "Copy Token",
    tokenQr: "Token QR",
    copyLink: "Copy Link",
    saveQr: "Save QR",
    decode: "Decode",
    decoderLabel: "SVG or NOMAI1 token",
    svgFile: "SVG file",
    qrImageFile: "QR image from gallery",
    decodeInput: "Decode Input",
    useToken: "Use Token",
    scanCamera: "Scan Camera",
    stopScan: "Stop Scan",
    decodedPlaceholder: "Decoded text appears here.",
    waitingDecode: "Waiting for decode.",
    checksum: "checksum",
    ok: "ok",
    failed: "failed",
    scanIdle: "Camera scanner is idle.",
    scanStopped: "Camera scanner stopped.",
    importedFromUrl: "Imported NOMAI1 token from URL.",
    permissionDenied: "Camera permission was denied. Allow camera access for this site, then tap Scan Camera again.",
    noCamera: "No usable camera was found. Try another browser or device.",
    cameraUnavailable: "Camera is unavailable in this browser.",
    httpsRequired: "Camera requires HTTPS. Open https://nomai.uk/ and try again.",
    cameraReady: "Allow camera access, then point the rear camera at a NOMAI1 QR.",
    previewNotReady: "Camera preview is not ready.",
    qrNotNomai: "QR found, but it is not a NOMAI1 token.",
    cameraDecoded: "Scanned NOMAI1 token and decoded it.",
    imageScanning: "Scanning QR image from gallery...",
    imageDecoded: "Scanned local QR image and decoded it.",
    imageFailed: "Could not find a usable NOMAI1 QR in that image."
  },
  zh: {
    languageName: "中文",
    switchLanguage: "English",
    subtitle: "文本转 Nomai 螺旋 SVG，SVG/token/QR 可还原原文。",
    saveSvg: "保存 SVG",
    decodeCurrent: "解码当前",
    encode: "编码",
    text: "文本",
    textPlaceholder: "输入任意语言文本...",
    seed: "随机种子",
    handwriting: "手写感",
    cameraQr: "相机 QR",
    copySvg: "复制 SVG",
    copyToken: "复制 Token",
    tokenQr: "Token QR",
    copyLink: "复制链接",
    saveQr: "保存 QR",
    decode: "解码",
    decoderLabel: "SVG 或 NOMAI1 token",
    svgFile: "SVG 文件",
    qrImageFile: "图库二维码图片",
    decodeInput: "解码输入",
    useToken: "使用 Token",
    scanCamera: "相机扫描",
    stopScan: "停止扫描",
    decodedPlaceholder: "解码结果会显示在这里。",
    waitingDecode: "等待解码。",
    checksum: "校验",
    ok: "通过",
    failed: "失败",
    scanIdle: "相机扫描器空闲。",
    scanStopped: "相机扫描已停止。",
    importedFromUrl: "已从 URL 导入 NOMAI1 token。",
    permissionDenied: "相机权限被拒绝。请允许此网站访问相机，然后再次点击相机扫描。",
    noCamera: "没有找到可用相机。请尝试其他浏览器或设备。",
    cameraUnavailable: "当前浏览器不可用相机。",
    httpsRequired: "相机需要 HTTPS。请打开 https://nomai.uk/ 后重试。",
    cameraReady: "允许相机权限后，将后置摄像头对准 NOMAI1 QR。",
    previewNotReady: "相机预览尚未准备好。",
    qrNotNomai: "识别到 QR，但它不是 NOMAI1 token。",
    cameraDecoded: "已扫描 NOMAI1 token 并完成解码。",
    imageScanning: "正在扫描图库二维码图片...",
    imageDecoded: "已扫描本地图像二维码并完成解码。",
    imageFailed: "这张图片里没有找到可用的 NOMAI1 QR。"
  }
} as const;

function getInitialLanguage(): Language {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }

  return "en";
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const [text, setText] = useState("你好，Nomai。今天适合看星星。");
  const [seed, setSeed] = useState(47);
  const [handwriting, setHandwriting] = useState(0);
  const [includeQrToken, setIncludeQrToken] = useState(false);
  const [decodeInput, setDecodeInput] = useState("");
  const [decodedText, setDecodedText] = useState("");
  const [decodedMeta, setDecodedMeta] = useState<string>(UI.en.waitingDecode);
  const [scanActive, setScanActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>(UI.en.scanIdle);
  const ui = UI[language];

  const encoded = useMemo(() => encodeToNomaiImage({
    originalText: text,
    seed,
    handwriting,
    includeQrToken
  }), [handwriting, includeQrToken, seed, text]);

  useEffect(() => () => {
    scannerControlsRef.current?.stop();
  }, []);

  function decode(value = decodeInput || encoded.svg) {
    try {
      const decoded = decodeNomaiImage(value);
      setDecodedText(decoded.originalText);
      const sourceLang = decoded.sourceLang && decoded.sourceLang !== "auto" ? `${decoded.sourceLang} | ` : "";
      setDecodedMeta(`${sourceLang}${ui.checksum} ${decoded.checksumOk ? ui.ok : ui.failed}${decoded.pivotEnglish ? ` | ${decoded.pivotEnglish}` : ""}`);
    } catch (error) {
      setDecodedText("");
      setDecodedMeta(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    const token = extractNomaiTokenFromScan(window.location.href);
    if (!token) return;

    setDecodeInput(token);
    decode(token);
    setScanStatus(ui.importedFromUrl);
  }, []);

  function stopCameraScan(message: string = ui.scanStopped) {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanActive(false);
    setScanStatus(message);
  }

  function formatCameraError(error: unknown): string {
    if (!(error instanceof DOMException)) {
      return error instanceof Error ? error.message : String(error);
    }

    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return ui.permissionDenied;
    }

    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return ui.noCamera;
    }

    return error.message || error.name;
  }

  async function startCameraScan() {
    if (scannerControlsRef.current) {
      stopCameraScan();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus(ui.cameraUnavailable);
      return;
    }

    if (!window.isSecureContext) {
      setScanStatus(ui.httpsRequired);
      return;
    }

    setScanActive(true);
    setScanStatus(ui.cameraReady);

    try {
      if (!videoRef.current) throw new Error(ui.previewNotReady);

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" }
        }
      };
      const controls = await reader.decodeFromConstraints(constraints, videoRef.current, (result, _error, activeControls) => {
        const scannedText = result?.getText();
        if (!scannedText) return;

        const token = extractNomaiTokenFromScan(scannedText);
        if (!token) {
          setScanStatus(ui.qrNotNomai);
          return;
        }

        setDecodeInput(token);
        decode(token);
        activeControls.stop();
        scannerControlsRef.current = null;
        setScanActive(false);
        setScanStatus(ui.cameraDecoded);
      });
      scannerControlsRef.current = controls;
    } catch (error) {
      stopCameraScan(formatCameraError(error));
    }
  }

  async function readSvgFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setDecodeInput(content);
    decode(content);
  }

  async function readQrImageFile(file: File | undefined) {
    if (!file) return;

    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanActive(false);
    setScanStatus(ui.imageScanning);

    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(url);
      const token = extractNomaiTokenFromScan(result.getText());

      if (!token) {
        setScanStatus(ui.qrNotNomai);
        return;
      }

      setDecodeInput(token);
      decode(token);
      setScanStatus(ui.imageDecoded);
    } catch (error) {
      setScanStatus(ui.imageFailed);
      setDecodedMeta(error instanceof Error ? `${ui.imageFailed} ${error.message}` : ui.imageFailed);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function downloadSvg() {
    const blob = new Blob([encoded.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nomai-message.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadQrSvg() {
    const blob = new Blob([encoded.tokenQrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nomai-token-qr.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <h1>Nomai Reversible</h1>
          <p>{ui.subtitle}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setLanguage(language === "en" ? "zh" : "en")} aria-label={ui.languageName}>
            {ui.switchLanguage}
          </button>
          <button type="button" onClick={downloadSvg}>{ui.saveSvg}</button>
          <button type="button" onClick={() => decode(encoded.svg)}>{ui.decodeCurrent}</button>
        </div>
      </section>

      <section className="workspace">
        <div className="panel editor">
          <h2>{ui.encode}</h2>
          <label htmlFor="source">{ui.text}</label>
          <textarea
            id="source"
            placeholder={ui.textPlaceholder}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <div className="split">
            <label htmlFor="seed">
              {ui.seed}
              <input id="seed" type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
            <label htmlFor="handwriting">
              {ui.handwriting}
              <input id="handwriting" type="range" min="0" max="0.5" step="0.01" value={handwriting} onChange={(event) => setHandwriting(Number(event.target.value))} />
            </label>
          </div>

          <label className="checkRow" htmlFor="cameraQr">
            <input
              id="cameraQr"
              type="checkbox"
              checked={includeQrToken}
              onChange={(event) => setIncludeQrToken(event.target.checked)}
            />
            {ui.cameraQr}
          </label>

          <div className="buttonRow">
            <button type="button" onClick={() => copy(encoded.svg)}>{ui.copySvg}</button>
            <button type="button" onClick={() => copy(encoded.tokenStream)}>{ui.copyToken}</button>
          </div>

          {includeQrToken ? (
            <div className="qrCard">
              <h3>{ui.tokenQr}</h3>
              <div className="qrPreview" dangerouslySetInnerHTML={{ __html: encoded.tokenQrSvg }} />
              <div className="buttonRow">
                <button type="button" onClick={() => copy(encoded.qrScanUrl)}>{ui.copyLink}</button>
                <button type="button" onClick={downloadQrSvg}>{ui.saveQr}</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="preview" dangerouslySetInnerHTML={{ __html: encoded.svg }} />

        <div className="panel decoder">
          <h2>{ui.decode}</h2>
          <label htmlFor="decoder">{ui.decoderLabel}</label>
          <textarea id="decoder" value={decodeInput} onChange={(event) => setDecodeInput(event.target.value)} />
          <label htmlFor="svgFile">
            {ui.svgFile}
            <input id="svgFile" className="fileInput" type="file" accept=".svg,image/svg+xml" onChange={(event) => void readSvgFile(event.target.files?.[0])} />
          </label>
          <label htmlFor="qrImageFile">
            {ui.qrImageFile}
            <input id="qrImageFile" className="fileInput" type="file" accept="image/*" onChange={(event) => void readQrImageFile(event.target.files?.[0])} />
          </label>
          <div className="buttonRow">
            <button type="button" onClick={() => decode()}>{ui.decodeInput}</button>
            <button type="button" onClick={() => setDecodeInput(encoded.tokenStream)}>{ui.useToken}</button>
          </div>
          <div className="buttonRow">
            <button type="button" onClick={() => void startCameraScan()}>{ui.scanCamera}</button>
            <button type="button" onClick={() => stopCameraScan()} disabled={!scanActive}>{ui.stopScan}</button>
          </div>
          <div className={`scanner ${scanActive ? "active" : ""}`}>
            <video ref={videoRef} className={scanActive ? "" : "hidden"} muted playsInline />
            <span>{scanStatus}</span>
          </div>
          <output className="decoded">
            <span>{decodedMeta}</span>
            <strong>{decodedText || ui.decodedPlaceholder}</strong>
          </output>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
