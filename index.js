const { Worker } = require("worker_threads");
const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());

// Configuration
const maxWorkers = 5; // Max concurrent tasks
const outputDir = path.join(__dirname, "output");
const progressFile = path.join(__dirname, "progress.json");

// Ensure output directory and progress file exist
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(progressFile))
  fs.writeFileSync(progressFile, JSON.stringify({ tasks: [] }, null, 2));

// Helper Functions
function loadProgress() {
  return JSON.parse(fs.readFileSync(progressFile, "utf-8"));
}

function saveProgress(progress) {
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
}

function updateTask(taskId, updates) {
  const progress = loadProgress();
  const task = progress.tasks.find((t) => t.taskId === taskId);

  if (!task) {
    progress.tasks.push({ taskId, ...updates });
  } else {
    Object.assign(task, updates);
  }

  saveProgress(progress);
}

// Validate URL format
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Queue System
const queue = [];
let activeWorkers = 0;

function processQueue() {
  if (queue.length === 0 || activeWorkers >= maxWorkers) return;

  const { url, taskId, index, resolve, reject } = queue.shift();
  activeWorkers++;

  const worker = new Worker("./worker.js", {
    workerData: { url, index, outputDir },
  });

  const startTime = Date.now();

  worker.on("message", (msg) => {
    activeWorkers--;
    const timeTaken = Date.now() - startTime;

    if (msg.error) {
      updateTask(taskId, {
        status: "in_progress",
        results: { [index]: { success: false, error: msg.error } },
        failed:
          (loadProgress().tasks.find((t) => t.taskId === taskId)?.failed || 0) +
          1,
      });
    } else {
      updateTask(taskId, {
        status: "in_progress",
        results: {
          [index]: { success: true, filePath: msg.filePath, timeTaken },
        },
        completed:
          (loadProgress().tasks.find((t) => t.taskId === taskId)?.completed ||
            0) + 1,
      });
    }

    resolve(msg);
    processQueue();
  });

  worker.on("error", (err) => {
    activeWorkers--;
    updateTask(taskId, {
      status: "in_progress",
      results: { [index]: { success: false, error: err.message } },
      failed:
        (loadProgress().tasks.find((t) => t.taskId === taskId)?.failed || 0) +
        1,
    });

    reject(err);
    processQueue();
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      activeWorkers--;
      reject(new Error(`Worker exited with code ${code}`));
    }
    processQueue();
  });
}

function addToQueue(url, taskId, index) {
  return new Promise((resolve, reject) => {
    queue.push({ url, taskId, index, resolve, reject });
    processQueue();
  });
}

// API Endpoints

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

app.use(limiter);

// POST /process-images: Add tasks to the queue
app.post("/process-images", (req, res) => {
  const imageUrls = req.body.urls;
  if (!Array.isArray(imageUrls)) {
    return res.status(400).send({ error: "Provide an array of URLs." });
  }

  // Validate URLs before adding to the queue
  const invalidUrls = imageUrls.filter((url) => !isValidUrl(url));
  if (invalidUrls.length > 0) {
    return res.status(400).send({
      error: "The following URLs are invalid:",
      invalidUrls,
    });
  }

  const taskId = Date.now().toString();
  updateTask(taskId, {
    status: "queued",
    total: imageUrls.length,
    completed: 0,
    failed: 0,
    results: {},
  });

  const promises = imageUrls.map((url, index) =>
    addToQueue(url, taskId, index)
  );

  Promise.allSettled(promises).then((results) => {
    const completed = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - completed;

    // Calculate average processing time for successful tasks only
    const successfulResults = results.filter((r) => r.status === "fulfilled");
    const totalTime = successfulResults.reduce(
      (sum, r) => sum + (r.value.timeTaken || 0),
      0
    );
    const avgTime = completed > 0 ? totalTime / completed : 0; // Avoid divide by 0 if no successful tasks

    // Update task status with summary
    updateTask(taskId, {
      status: "completed",
      completed,
      failed,
      averageTime: `${avgTime.toFixed(2)} ms`,
    });

    // Send back summary response
    res.send({
      taskId,
      summary: {
        total: imageUrls.length,
        completed,
        failed,
        averageTime: `${avgTime.toFixed(2)} ms`,
      },
    });
  });
});

// GET /status: Get task progress
app.get("/status/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const progress = loadProgress();
  const task = progress.tasks.find((t) => t.taskId === taskId);

  if (!task) {
    return res.status(404).send({ error: "Task not found" });
  }

  res.send(task);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
