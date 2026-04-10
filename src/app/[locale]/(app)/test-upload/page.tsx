"use client";

import { useRef, useState } from "react";

export default function TestUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  }

  return (
    <div style={{ padding: 40, color: "white" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>File Upload Debug</h1>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type something first, then try upload..."
        style={{ width: "100%", height: 100, background: "#222", color: "white", padding: 10, marginBottom: 10, border: "1px solid #444" }}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {/* Method 1: onClick + display:none */}
        <div>
          <input
            ref={fileRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              addLog(`Method 1: got ${e.target.files?.length} files`);
              if (e.target.files) setFiles(Array.from(e.target.files).map(f => f.name));
              e.target.value = "";
            }}
          />
          <button
            onClick={() => {
              addLog("Method 1: onClick fired");
              fileRef.current?.click();
            }}
            style={{ padding: "8px 16px", background: "#444", color: "white", border: "none", cursor: "pointer" }}
          >
            Method 1: onClick + display:none
          </button>
        </div>

        {/* Method 2: label + htmlFor */}
        <div>
          <input
            id="test-file-2"
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              addLog(`Method 2: got ${e.target.files?.length} files`);
              if (e.target.files) setFiles(Array.from(e.target.files).map(f => f.name));
              e.target.value = "";
            }}
          />
          <label
            htmlFor="test-file-2"
            style={{ padding: "8px 16px", background: "#555", color: "white", cursor: "pointer", display: "inline-block" }}
          >
            Method 2: label htmlFor
          </label>
        </div>

        {/* Method 3: onMouseDown */}
        <div>
          <input
            id="test-file-3"
            type="file"
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
            onChange={(e) => {
              addLog(`Method 3: got ${e.target.files?.length} files`);
              if (e.target.files) setFiles(Array.from(e.target.files).map(f => f.name));
              e.target.value = "";
            }}
          />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              addLog("Method 3: onMouseDown fired");
              document.getElementById("test-file-3")?.click();
            }}
            style={{ padding: "8px 16px", background: "#666", color: "white", border: "none", cursor: "pointer" }}
          >
            Method 3: onMouseDown + clip
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        Files: {files.length ? files.join(", ") : "none"}
      </div>

      <div style={{ background: "#111", padding: 10, maxHeight: 200, overflow: "auto", fontSize: 12 }}>
        <strong>Log:</strong>
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
