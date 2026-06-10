import React, { useState, useEffect } from "react";
import { getSocket } from "../services/socket";
import { useSocketEvents } from "../hooks/useSocketEvents";

/**
 * RecognitionProgress Component
 * Tracks active face recognition jobs and displays basic progress bars.
 * Keeps independent of authentication context / lifecycle.
 * Displays progress using a Map keyed by jobId, hiding internal jobIds.
 * Stays visible briefly at 100% when a job completes before auto-removing.
 */
const RecognitionProgress = () => {
  const [socket, setSocket] = useState(null);
  const [jobs, setJobs] = useState(new Map());

  // Periodically check/retrieve the active socket instance.
  // This keeps the hook updated when the socket initializes or changes.
  useEffect(() => {
    setSocket(getSocket());
    const interval = setInterval(() => {
      const activeSocket = getSocket();
      if (activeSocket !== socket) {
        setSocket(activeSocket);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [socket]);

  useSocketEvents(socket, {
    onRecognitionProgress: (payload) => {
      const { jobId, progress, photoId } = payload;
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(jobId, { jobId, progress, photoId });
        return next;
      });
    },
    onRecognitionDone: (payload) => {
      const { jobId, photoId } = payload;
      
      // Update progress to 100% for final feedback
      setJobs((prev) => {
        const next = new Map(prev);
        const currentJob = next.get(jobId) || { jobId, photoId };
        next.set(jobId, { ...currentJob, progress: 100 });
        return next;
      });

      // Keep the progress bar visible at 100% briefly before removing
      setTimeout(() => {
        setJobs((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }, 1500);
    }
  });

  const activeJobs = Array.from(jobs.values());
  if (activeJobs.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid #e8e4dc",
        borderRadius: "8px",
        padding: "12px 16px",
        margin: "16px",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)"
      }}
    >
      <h3
        style={{
          margin: "0 0 12px 0",
          fontSize: "12px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#6b6760",
          fontFamily: "monospace"
        }}
      >
        Recognition Activity
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {activeJobs.map((job) => (
          <div key={job.jobId} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "#0f0e0c"
              }}
            >
              <span>Processing photo: {job.photoId || "Pending..."}</span>
              <span style={{ fontWeight: "bold" }}>{job.progress}%</span>
            </div>
            <div
              style={{
                width: "100%",
                backgroundColor: "#f2f0eb",
                height: "8px",
                borderRadius: "4px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${job.progress}%`,
                  backgroundColor: "#c8501a",
                  height: "100%",
                  transition: "width 0.2s ease"
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecognitionProgress;
