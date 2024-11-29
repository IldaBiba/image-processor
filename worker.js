const { parentPort, workerData } = require("worker_threads");
const sharp = require("sharp");
const axios = require("axios");
const path = require("path");

// Function to process an image (download, resize, grayscale, save)
async function processImage(url, index, outputDir) {
  const startTime = Date.now(); // Start time to calculate processing time
  try {
    // Download the image using axios
    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer", // Download image as binary data
      timeout: 10000, // Optional: Set a timeout for the request (10 seconds)
    });

    const buffer = Buffer.from(response.data); // Convert binary data to a buffer
    const outputPath = path.join(outputDir, `image_${index}.png`); // Set the output path

    // Process the image: resize and convert to grayscale
    await sharp(buffer)
      .resize(200) // Resize to 200px width (maintains aspect ratio)
      .grayscale() // Convert to grayscale
      .toFile(outputPath); // Save the processed image

    // Send success message to main thread
    const timeTaken = Date.now() - startTime; // Calculate the time taken for processing
    parentPort.postMessage({
      success: true,
      filePath: outputPath,
      timeTaken: timeTaken,
    });
  } catch (error) {
    // Send failure message to main thread
    const timeTaken = Date.now() - startTime; // Calculate time even if failed
    parentPort.postMessage({
      success: false,
      error: error.message,
      timeTaken: timeTaken,
    });
  }
}

// Start processing the image
processImage(workerData.url, workerData.index, workerData.outputDir);
