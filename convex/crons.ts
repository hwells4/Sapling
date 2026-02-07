import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process expired approval checkpoints every 30 seconds
crons.interval(
  "process approval timeouts",
  { seconds: 30 },
  internal.approvals.processTimeouts,
);

export default crons;
