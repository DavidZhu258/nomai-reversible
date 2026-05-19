import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { decodeNomaiImage, encodeToNomaiImage } from "./translationFlow";
import "./styles.css";

function App() {
  const [text, setText] = useState("你好，Nomai。今天适合看星星。");
  const [seed, setSeed] = useState(47);
  const [handwriting, setHandwriting] = useState(0);
  const [decodeInput, setDecodeInput] = useState("");
  const [decodedText, setDecodedText] = useState("");
  const [decodedMeta, setDecodedMeta] = useState("Waiting for decode.");

  const encoded = useMemo(() => encodeToNomaiImage({
    originalText: text,
    seed,
    handwriting
  }), [handwriting, seed, text]);

  function decode(value = decodeInput || encoded.svg) {
    try {
      const decoded = decodeNomaiImage(value);
      setDecodedText(decoded.originalText);
      const sourceLang = decoded.sourceLang && decoded.sourceLang !== "auto" ? `${decoded.sourceLang} | ` : "";
      setDecodedMeta(`${sourceLang}checksum ${decoded.checksumOk ? "ok" : "failed"}${decoded.pivotEnglish ? ` | ${decoded.pivotEnglish}` : ""}`);
    } catch (error) {
      setDecodedText("");
      setDecodedMeta(error instanceof Error ? error.message : String(error));
    }
  }

  async function readSvgFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setDecodeInput(content);
    decode(content);
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

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <h1>Nomai Reversible</h1>
          <p>Text to spiral SVG, SVG/token back to original text.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={downloadSvg}>Download SVG</button>
          <button type="button" onClick={() => decode(encoded.svg)}>Decode Current</button>
        </div>
      </section>

      <section className="workspace">
        <div className="panel editor">
          <h2>Encode</h2>
          <label htmlFor="source">Text</label>
          <textarea
            id="source"
            placeholder="Enter text in any language..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <div className="split">
            <label htmlFor="seed">
              Seed
              <input id="seed" type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
            <label htmlFor="handwriting">
              Handwriting
              <input id="handwriting" type="range" min="0" max="0.5" step="0.01" value={handwriting} onChange={(event) => setHandwriting(Number(event.target.value))} />
            </label>
          </div>

          <div className="buttonRow">
            <button type="button" onClick={() => copy(encoded.svg)}>Copy SVG</button>
            <button type="button" onClick={() => copy(encoded.tokenStream)}>Copy Token</button>
          </div>
        </div>

        <div className="preview" dangerouslySetInnerHTML={{ __html: encoded.svg }} />

        <div className="panel decoder">
          <h2>Decode</h2>
          <label htmlFor="decoder">SVG or NOMAI1 token</label>
          <textarea id="decoder" value={decodeInput} onChange={(event) => setDecodeInput(event.target.value)} />
          <input className="fileInput" type="file" accept=".svg,image/svg+xml" onChange={(event) => void readSvgFile(event.target.files?.[0])} />
          <div className="buttonRow">
            <button type="button" onClick={() => decode()}>Decode Input</button>
            <button type="button" onClick={() => setDecodeInput(encoded.tokenStream)}>Use Token</button>
          </div>
          <output className="decoded">
            <span>{decodedMeta}</span>
            <strong>{decodedText || "Decoded text appears here."}</strong>
          </output>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
