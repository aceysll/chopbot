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

// Draggable clip preview card
function ClipCard({ clip, index, total, onMoveUp, onMoveDown, onRemove, originalIndex }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 10,
      background: C.surface, border: `1px solid ${C.border}`,
      marginBottom: 6, transition: "background 0.15s",
    }}>
      {/* Position number */}
      <div style={{ width: 24, height: 24, borderRadius: 6, background: C.elevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
        {index + 1}
      </div>

      {/* Clip info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Clip {originalIndex + 1}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{formatTime(clip.start)} – {formatTime(clip.end)}</div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.elevated, color: index === 0 ? C.muted : C.sub, fontSize: 12, cursor: index === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >↑</button>
        <button
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.elevated, color: index === total - 1 ? C.muted : C.sub, fontSize: 12, cursor: index === total - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >↓</button>
        <button
          onClick={() => onRemove(index)}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.danger}30`, background: "#1a0810", color: C.danger, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >×</button>
      </div>
    </div>
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
  const [dropActive, setDropActive] = useState(false);

  // New state for clip preview
  const [clips, setClips]           = useState([]); // [{start, end, originalIndex, filename}]
  const [stitching, setStitching]   = useState(false);

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
    setClips([]);
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

  // Step 1: Cut clips and show preview
  const chopClips = async () => {
    if (!videoFile || !duration) return;
    setStatus("loading");
    setProgress(0);
    setErrorMsg("");
    setDownloadUrl(null);
    setClips([]);

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
      const order  = shuffle([...Array(total).keys()]);
      const newClips = [];

      for (let i = 0; i < order.length; i++) {
        const idx   = order[i];
        const start = idx * segLen;
        const end   = Math.min((idx + 1) * segLen, duration);
        const out   = `seg_${i}.mp4`;

        setProgressLabel(`Cutting clip ${i + 1} of ${total}...`);
        setProgress(Math.round((i / total) * 90) + 5);

        await ff.run(
          "-ss", start.toFixed(3),
          "-to", end.toFixed(3),
          "-i", inputName,
          "-c:v", "libx264", "-c:a", "aac", "-preset", "ultrafast",
          "-avoid_negative_ts", "1", out
        );

        newClips.push({ start, end, originalIndex: idx, filename: out });
      }

      setProgress(100);
      setProgressLabel("Done! Review and reorder your clips below.");
      setClips(newClips);
      setStatus("preview");

    } catch (e) {
      console.error(e);
      setErrorMsg("Something went wrong. Try a larger clip length or a shorter video.");
      setStatus("error");
    }
  };

  // Step 2: Stitch in current order and download
  const stitchAndDownload = async () => {
    if (!ffmpegRef.current || clips.length === 0) return;
    setStitching(true);
    setErrorMsg("");

    try {
      const ff = ffmpegRef.current;
      setProgressLabel("Joining clips in your chosen order...");

      ff.FS("writeFile", "concat.txt", clips.map(c => `file '${c.filename}'`).join("\n"));
      await ff.run("-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "output.mp4");

      const data = ff.FS("readFile", "output.mp4");
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url  = URL.createObjectURL(blob);
      setDownloadUrl(url);

      const a = document.createElement("a");
      a.href = url; a.download = "chopbot_reshuffled.mp4";
      document.body.appendChild(a); a.click();
      setTimeout(() => document.body.removeChild(a), 1000);

      ff.FS("unlink", "concat.txt");
      ff.FS("unlink", "output.mp4");

      setStatus("done");
    } catch (e) {
      setErrorMsg("Stitching failed. Try rechoping.");
    }
    setStitching(false);
  };

  // Clip reorder controls
  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...clips];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setClips(next);
    setDownloadUrl(null);
    setStatus("preview");
  };

  const moveDown = (i) => {
    if (i === clips.length - 1) return;
    const next = [...clips];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setClips(next);
    setDownloadUrl(null);
    setStatus("preview");
  };

  const removeClip = (i) => {
    setClips(clips.filter((_, idx) => idx !== i));
    setDownloadUrl(null);
    setStatus("preview");
  };

  const reshuffle = () => {
    setClips(shuffle([...clips]));
    setDownloadUrl(null);
    setStatus("preview");
  };

  const reset = () => {
    setVideoFile(null); setVideoSrc(null); setVideoName("");
    setDuration(0); setDownloadUrl(null); setStatus("idle");
    setProgress(0); setClips([]); setErrorMsg("");
  };

  const totalClips   = duration ? Math.floor(duration / clipLength) : 0;
  const isProcessing = status === "loading" || status === "processing";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } a { text-decoration: none; }`}</style>

      {/* Nav */}
      <nav style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10, background: C.bg }}>
        <button onClick={() => navigate("/")} style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
          chop<span style={{ color: C.accent }}>bot</span>
        </button>
        <a href="https://buildbyace.vercel.app" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.muted }}>by ace ↗</a>
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
              style={{ border: `2px dashed ${dropActive ? C.accent : C.borderHi}`, borderRadius: 16, padding: "56px 24px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s, background 0.2s", background: dropActive ? C.accentSub : C.surface, marginBottom: 24 }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop your video here</div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>or click to browse</div>
              <div style={{ display: "inline-block", padding: "10px 22px", borderRadius: 8, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}>Choose file</div>
            </div>
            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {[
                { n: "01", title: "Upload a video", desc: "Any format. Drop it in or click to browse." },
                { n: "02", title: "Pick a clip length", desc: "Shorter = more chaos. Longer = more subtle." },
                { n: "03", title: "Review and reorder", desc: "See your clips, remove any, drag to reorder." },
                { n: "04", title: "Download", desc: "Stitched in your chosen order. Ready instantly." },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "16px 20px", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
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
            {/* Video preview */}
            <div style={{ borderRadius: 14, overflow: "hidden", background: "#000", border: `1px solid ${C.border}`, marginBottom: 24 }}>
              <video ref={videoRef} src={videoSrc} style={{ width: "100%", display: "block", maxHeight: 260 }} onLoadedMetadata={(e) => setDuration(e.target.duration)} controls />
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden", marginBottom: 24, border: `1px solid ${C.border}` }}>
              {[
                { label: "Duration", value: formatTime(duration) },
                { label: "Clip length", value: `${clipLength}s` },
                { label: "Total clips", value: status === "preview" ? clips.length : (totalClips || "—") },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.surface, padding: "14px 16px" }}>
                  <Stat label={label} value={value} />
                </div>
              ))}
            </div>

            {/* Clip length slider - hide after chopping */}
            {status !== "preview" && status !== "done" && (
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
            )}

            {/* Info preview */}
            {totalClips >= 2 && !isProcessing && status === "idle" && (
              <div style={{ background: C.accentSub, borderRadius: 12, border: `1px solid ${C.accent}30`, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
                Your <strong style={{ color: C.text }}>{formatTime(duration)}</strong> video will be split into{" "}
                <strong style={{ color: C.accent }}>{totalClips} clips</strong> of{" "}
                <strong style={{ color: C.accent }}>{clipLength}s each</strong>, reshuffled randomly. You can reorder before downloading.
                {duration % clipLength > 1 && <span style={{ color: C.muted }}> The last {Math.floor(duration % clipLength)}s will be trimmed.</span>}
              </div>
            )}

            {/* Progress */}
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

            {/* Error */}
            {status === "error" && (
              <div style={{ background: "#1a0810", border: `1px solid ${C.danger}40`, borderRadius: 12, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: C.danger, lineHeight: 1.6 }}>
                ⚠ {errorMsg}
              </div>
            )}

            {/* Clip preview and reorder */}
            {(status === "preview" || status === "done") && clips.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {clips.length} clips · drag to reorder
                  </div>
                  <button onClick={reshuffle} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.elevated, color: C.sub, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    🔀 Reshuffle
                  </button>
                </div>
                {clips.map((clip, i) => (
                  <ClipCard
                    key={`${clip.filename}-${i}`}
                    clip={clip}
                    index={i}
                    total={clips.length}
                    originalIndex={clip.originalIndex}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onRemove={removeClip}
                  />
                ))}
              </div>
            )}

            {/* Download success */}
            {status === "done" && downloadUrl && (
              <div style={{ background: C.successSub, borderRadius: 12, border: `1px solid ${C.success}40`, padding: "20px", marginBottom: 24, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.success, marginBottom: 4 }}>Your video is ready</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }}>{clips.length} clips in your chosen order</div>
                <a href={downloadUrl} download="chopbot_reshuffled.mp4" style={{ display: "block", padding: "13px", borderRadius: 10, background: C.success, color: "#000", fontWeight: 800, fontSize: 13, letterSpacing: "0.02em" }}>
                  ⬇ Download video
                </a>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {status === "idle" && (
                <button onClick={chopClips} disabled={isProcessing || totalClips < 2} style={{ padding: "14px", borderRadius: 10, border: "none", background: totalClips < 2 ? C.elevated : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: totalClips < 2 ? "not-allowed" : "pointer", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                  ✂ Chop into clips
                </button>
              )}
              {status === "preview" && (
                <button onClick={stitchAndDownload} disabled={stitching || clips.length < 1} style={{ padding: "14px", borderRadius: 10, border: "none", background: clips.length < 1 ? C.elevated : C.success, color: clips.length < 1 ? C.muted : "#000", fontSize: 14, fontWeight: 700, cursor: clips.length < 1 ? "not-allowed" : "pointer", fontFamily: FONT }}>
                  {stitching ? "Stitching..." : `⬇ Download ${clips.length} clips`}
                </button>
              )}
              {status === "done" && (
                <>
                  <button onClick={stitchAndDownload} disabled={stitching} style={{ padding: "14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.elevated, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    {stitching ? "Stitching..." : "⬇ Download with current order"}
                  </button>
                  <button onClick={() => { setStatus("idle"); setClips([]); setDownloadUrl(null); }} style={{ padding: "13px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>
                    ✂ Chop again with different settings
                  </button>
                </>
              )}
              <button onClick={reset} disabled={isProcessing || stitching} style={{ padding: "13px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>
                ← Upload a different video
              </button>
            </div>

            {totalClips < 2 && duration > 0 && status === "idle" && (
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
