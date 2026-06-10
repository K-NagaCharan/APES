import React, { useState, useEffect } from "react";
import { getSocket } from "../services/socket";
import { useSocketEvents } from "../hooks/useSocketEvents";

/**
 * DeliveryStatus Component
 * Displays floating notification cards in the bottom right corner for active photo deliveries.
 * Responds to socket events to transition card states and auto-removes them after completion.
 */
const DeliveryStatus = () => {
  const [socket, setSocket] = useState(null);
  const [jobs, setJobs] = useState(new Map());

  // Capture socket instance on component mount
  useEffect(() => {
    setSocket(getSocket());
  }, []);

  useSocketEvents(socket, {
    onDeliveryStarted: (payload) => {
      const { jobId, deliveryId } = payload;
      setJobs((prev) => {
        const next = new Map(prev);
        next.set(jobId, { jobId, deliveryId, status: "delivering", error: null });
        return next;
      });
    },
    onDeliveryDone: (payload) => {
      const { jobId, deliveryId } = payload;
      setJobs((prev) => {
        const next = new Map(prev);
        if (next.has(jobId)) {
          next.set(jobId, { ...next.get(jobId), status: "success" });
        } else {
          next.set(jobId, { jobId, deliveryId, status: "success", error: null });
        }
        return next;
      });

      // Automatically remove card after 3 seconds
      setTimeout(() => {
        setJobs((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }, 3000);
    },
    onDeliveryFailed: (payload) => {
      const { jobId, deliveryId, reason } = payload;
      setJobs((prev) => {
        const next = new Map(prev);
        if (next.has(jobId)) {
          next.set(jobId, { ...next.get(jobId), status: "failed", error: reason });
        } else {
          next.set(jobId, { jobId, deliveryId, status: "failed", error: reason });
        }
        return next;
      });

      // Automatically remove card after 3 seconds
      setTimeout(() => {
        setJobs((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }, 3000);
    }
  });

  const activeJobs = Array.from(jobs.values());
  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {activeJobs.map((job) => {
        let cardBg = "bg-white border-[#e8e4dc]";
        let titleColor = "text-[#0f0e0c]";
        let statusText = "Delivering...";
        let statusIcon = (
          <div className="w-5 h-5 border-2 border-[#c8501a] border-t-transparent rounded-full animate-spin" />
        );

        if (job.status === "success") {
          cardBg = "bg-[#f4fbf7] border-[#d1ebd9] shadow-sm";
          titleColor = "text-[#0f6e56]";
          statusText = "Delivery Complete";
          statusIcon = (
            <div className="w-5 h-5 bg-[#0f6e56] rounded-full flex items-center justify-center text-white text-xs font-bold">
              ✓
            </div>
          );
        } else if (job.status === "failed") {
          cardBg = "bg-[#fdf3f0] border-[#fad5cb] shadow-sm";
          titleColor = "text-[#c8501a]";
          statusText = "Delivery Failed";
          statusIcon = (
            <div className="w-5 h-5 bg-[#c8501a] rounded-full flex items-center justify-center text-white text-xs font-bold">
              !
            </div>
          );
        }

        return (
          <div
            key={job.jobId}
            className={`pointer-events-auto p-4 border rounded-xl shadow-md transition-all duration-300 transform translate-y-0 opacity-100 flex items-start space-x-3 ${cardBg}`}
          >
            <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>
            <div className="flex-grow min-w-0">
              <h4 className={`text-xs font-semibold ${titleColor}`}>
                {statusText}
              </h4>
              <p className="text-[10px] text-[#6b6760] font-mono truncate mt-0.5">
                Job ID: {job.jobId}
              </p>
              {job.error && (
                <p className="text-[10px] text-[#c8501a] font-sans mt-1 leading-normal break-words bg-white/50 p-1.5 rounded border border-[#fad5cb]/50">
                  {job.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DeliveryStatus;
