import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const C = {
  bg:        "#0c0c10",
  surface:   "#13131a",
  elevated:  "#1c1c26",
  border:    "#ffffff0f",
  borderHi:  "#ffffff1a",
  accent:    "#ff3c5f",
  accentSub: "#ff3c5f22",
  accentHi:  "#ff6080",
  success:   "#00e5a0",
  successSub:"#00e5a015",
  danger:    "#ff4d6d",
  text:      "#f0f0f4",
  sub:       "#9090a8",
  muted:     "#50506a",
};

const FONT = "'Inter', 'SF Pro Display', system-ui, sans-serif";

function formatTime(s) {
  if (!s && s !== 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Stat({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Pill({ children, color = C.accent }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: color + "20", border: `1px solid ${color}40`,
      fontSize: 10, fontWeight: 600, color, letterSpacing: "0.06em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {children}
    </span>
  );
}

export default function Editor() {
  const navigate = useNavigate();
  const [videoFile, setVideoFile]   = useState(null);
  const [videoSrc, setVideoSrc]     = useState(null);
  const [videoName, setVideoName]   = useState("");
  const [duration, setDuration]     = useState(0);
  const [clipLength, setClipLength] = useState(5);
  const [status, setStatus]         = useState("idle");
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [clipCount, setClipCount]   = useState(0);
  const [dropActive, setDropActive] = useState(false);

  const fileRef   = useRef(null);
  const ffmpegRef = useRef(null);
  const videoRef  = useRef(null);

  const handleFile = (file) => {
    if (!file?.type.startsWith("video/")) return;
    setVideoFile(file);
    setVideoSrc(URL.createObjectURL(file));
    setVideoName(file.name);
    setDownloadUrl(null);
    setStatus("idle");
    setErrorMsg("");
    setClipCount(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDropActive(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setProgressLabel("Loading video processor (first time only, ~15 seconds)...");
    const ff = createFFmpeg({
      log: true,
      corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      progress: ({ ratio }) => { if (ratio > 0) setProgress(Math.round(ratio * 100)); },
    });
    await ff.load();
    ffmpegRef.current = ff;
    return ff;
  };

  const process = async () => {
    if (!videoFile || !duration) return;
    setStatus("loading");
    setProgress(0);
    setErrorMsg("");
    setDownloadUrl(null);

    try {
      const ff = await loadFFmpeg();
      setStatus("processing");
      setProgressLabel("Reading your video...");
      setProgress(2);

      const ext = videoName.split(".").pop() || "mp4";
      const inputName = `input.${ext}`;
      ff.FS("writeFile", inputName, await fetchFile(videoFile));

      const segLen = parseFloat(clipLength);
      const total  = Math.floor(duration / segLen);
      setClipCount(total);

      const order     = shuffle([...Array(total).keys()]);
      const clipFiles = [];

      for (let i = 0; i < order.length; i++) {
        const idx   = order[i];
        const start = (idx * segLen).toFixed(3);
        const end   = Math.min((idx + 1) * segLen, duration).toFixed(3);
        const out   = `seg_${i}.mp4`;

        setProgressLabel(`Cutting clip ${i + 1} of ${total}...`);
        setProgress(Math.round((i / total) * 75) + 5);

        await ff.run("-ss", start, "-to", end, "-i", inputName,
          "-c:v", "libx264", "-c:a", "aac", "-preset", "ultrafast",
          "-avoid_negative_ts", "1", out);

        clipFiles.push(out);
      }

      setProgressLabel("Joining clips together...");
      setProgress(82);

      ff.FS("writeFile", "concat.txt", clipFiles.map(f => `file '${f}'`).join("\n"));
      await ff.run("-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "output.mp4");

      setProgressLabel("Packaging your download...");
      setProgress(95);

      const data = ff.FS("readFile", "output.mp4");
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url  = URL.createObjectURL(blob);
      setDownloadUrl(url);

      const a = document.createElement("a");
      a.href = url; a.download = "chopbot_reshuffled.mp4";
      document.body.appendChild(a); a.click();
      setTimeout(() => document.body.removeChild(a), 1000);

      ff.FS("unlink", inputName);
      ff.FS("unlink", "concat.txt");
      ff.FS("unlink", "output.mp4");
      for (const f of clipFiles) { try { ff.FS("unlink", f); } catch (_) {} }

      setProgress(100);
      setProgressLabel("Done!");
      setStatus("done");

    } catch (e) {
      console.error(e);
      setErrorMsg("Something went wrong. Try a larger clip length or a shorter video.");
      setStatus("error");
    }
  };

  const reset = () => {
    setVideoFile(null); setVideoSrc(null); setVideoName("");
    setDuration(0); setDownloadUrl(null); setStatus("idle");
    setProgress(0); setClipCount(0); setErrorMsg("");
  };

  const totalClips  = duration ? Math.floor(duration / clipLength) : 0;
  const isProcessing = status === "loading" || status === "processing";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } a { text-decoration: none; }`}</style>

      {/* Nav */}
      <nav style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10, background: C.bg }}>
        <button onClick={() => navigate("/")} style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
          chop<span style={{ color: C.accent }}>bot</span>
        </button>
        <a href="https://buildbyace.vercel.app" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.muted }}>by ace ↗</a>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px" }}>
        {!videoFile ? (
          <>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>Upload your video</h1>
              <p style={{ fontSize: 14, color: C.sub }}>MP4, MOV, AVI or any video format.</p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
              onDragLeave={() => setDropActive(false)}
              style={{
                border: `2px dashed ${dropActive ? C.accent : C.borderHi}`,
                borderRadius: 16, padding: "56px 24px", textAlign: "center",
                cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
                background: dropActive ? C.accentSub : C.surface, marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop your video here</div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>or click to browse</div>
              <div style={{
                display: "inline-block", padding: "10px 22px", borderRadius: 8,
                background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700,
              }}>
                Choose file
              </div>
            </div>
            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {[
                { n: "01", title: "Upload a video", desc: "Any format. Drop it in or click to browse." },
                { n: "02", title: "Pick a clip length", desc: "Shorter = more chaos. Longer = more subtle." },
                { n: "03", title: "Chop and download", desc: "Sliced, shuffled, stitched. Downloads automatically." },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "16px 20px", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: C.elevated, border: `1px solid ${C.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.accent }}>{step.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: C.sub }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ borderRadius: 14, overflow: "hidden", background: "#000", border: `1px solid ${C.border}`, marginBottom: 24 }}>
              <video ref={videoRef} src={videoSrc} style={{ width: "100%", display: "block", maxHeight: 260 }} onLoadedMetadata={(e) => setDuration(e.target.duration)} controls />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden", marginBottom: 24, border: `1px solid ${C.border}` }}>
              {[
                { label: "Duration", value: formatTime(duration) },
                { label: "Clip length", value: `${clipLength}s` },
                { label: "Total clips", value: totalClips || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.surface, padding: "14px 16px" }}>
                  <Stat label={label} value={value} />
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Clip length</div>
                  <div style={{ fontSize: 11, color: C.sub }}>Shorter = more chaotic · Longer = more subtle</div>
                </div>
                <div style={{ background: C.accentSub, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "6px 12px", fontSize: 16, fontWeight: 800, color: C.accent, minWidth: 56, textAlign: "center" }}>
                  {clipLength}s
                </div>
              </div>
              <input type="range" min={2} max={30} step={1} value={clipLength} onChange={(e) => setClipLength(Number(e.target.value))} disabled={isProcessing} style={{ width: "100%", accentColor: C.accent, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 6 }}>
                <span>2s</span><span>30s</span>
              </div>
            </div>

            {totalClips >= 2 && !isProcessing && status !== "done" && (
              <div style={{ background: C.accentSub, borderRadius: 12, border: `1px solid ${C.accent}30`, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
                Your <strong style={{ color: C.text }}>{formatTime(duration)}</strong> video will be split into{" "}
                <strong style={{ color: C.accent }}>{totalClips} clips</strong> of{" "}
                <strong style={{ color: C.accent }}>{clipLength}s each</strong>, reshuffled randomly, and stitched back into one file.
                {duration % clipLength > 1 && <span style={{ color: C.muted }}> The last {Math.floor(duration % clipLength)}s will be trimmed.</span>}
              </div>
            )}

            {isProcessing && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{progressLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{progress}%</div>
                </div>
                <div style={{ height: 4, background: C.elevated, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${C.accent}, ${C.accentHi})`, width: `${progress}%`, transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Keep this tab open while processing.</div>
              </div>
            )}

            {status === "error" && (
              <div style={{ background: "#1a0810", border: `1px solid ${C.danger}40`, borderRadius: 12, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: C.danger, lineHeight: 1.6 }}>
                ⚠ {errorMsg}
              </div>
            )}

            {status === "done" && downloadUrl && (
              <div style={{ background: C.successSub, borderRadius: 12, border: `1px solid ${C.success}40`, padding: "20px", marginBottom: 24, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.success, marginBottom: 4 }}>Your reshuffled video is ready</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }}>{clipCount} clips in a new random order</div>
                <a href={downloadUrl} download="chopbot_reshuffled.mp4" style={{ display: "block", padding: "13px", borderRadius: 10, background: C.success, color: "#000", fontWeight: 800, fontSize: 13, letterSpacing: "0.02em" }}>
                  ⬇ Download video
                </a>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {status !== "done" && (
                <button onClick={process} disabled={isProcessing || totalClips < 2} style={{ padding: "14px", borderRadius: 10, border: "none", background: isProcessing || totalClips < 2 ? C.elevated : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: isProcessing || totalClips < 2 ? "not-allowed" : "pointer", fontFamily: FONT, letterSpacing: "-0.01em", transition: "background 0.2s" }}>
                  {isProcessing ? "Processing..." : "✂ Chop and reshuffle"}
                </button>
              )}
              {status === "done" && (
                <button onClick={process} disabled={isProcessing} style={{ padding: "14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.elevated, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  🔀 Reshuffle again
                </button>
              )}
              <button onClick={reset} disabled={isProcessing} style={{ padding: "13px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>
                ← Upload a different video
              </button>
            </div>

            {totalClips < 2 && duration > 0 && (
              <div style={{ fontSize: 12, color: C.danger, marginTop: 12, textAlign: "center" }}>
                Clip length too long. Reduce it to get at least 2 clips.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
