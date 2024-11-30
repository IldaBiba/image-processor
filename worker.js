const { parentPort, workerData } = require("worker_threads");
const sharp = require("sharp");
const axios = require("axios");
const path = require("path");

async function processImage(url, index, outputDir) {
  const startTime = Date.now();
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const buffer = Buffer.from(response.data);
    const outputPath = path.join(outputDir, `image_${index}.png`);

    await sharp(buffer).resize(200).grayscale().toFile(outputPath);

    const timeTaken = Date.now() - startTime;
    parentPort.postMessage({
      success: true,
      filePath: outputPath,
      timeTaken: timeTaken,
    });
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    parentPort.postMessage({
      success: false,
      error: error.message,
      timeTaken: timeTaken,
    });
  }
}

processImage(workerData.url, workerData.index, workerData.outputDir);
