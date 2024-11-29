// const { parentPort, workerData } = require("worker_threads");
// const sharp = require("sharp");
// const axios = require("axios");
// const path = require("path");

// // Function to process an image (download, resize, grayscale, save)
// async function processImage(url, index, outputDir) {
//   const startTime = Date.now(); // Start time to calculate processing time
//   try {
//     // Download the image using axios
//     const response = await axios({
//       url,
//       method: "GET",
//       responseType: "arraybuffer", // Download image as binary data
//     });

//     const buffer = Buffer.from(response.data); // Convert binary data to a buffer
//     const outputPath = path.join(outputDir, `image_${index}.png`); // Set the output path

//     // Process the image: resize and convert to grayscale
//     await sharp(buffer)
//       .resize(200) // Resize to 200px width (maintains aspect ratio)
//       .grayscale() // Convert to grayscale
//       .toFile(outputPath); // Save the processed image

//     // Send success message to main thread
//     const timeTaken = Date.now() - startTime; // Calculate the time taken for processing
//     parentPort.postMessage({
//       success: true,
//       filePath: outputPath,
//       timeTaken: timeTaken,
//     });
//   } catch (error) {
//     // Send failure message to main thread
//     const timeTaken = Date.now() - startTime; // Calculate time even if failed
//     parentPort.postMessage({
//       success: false,
//       error: error.message,
//       timeTaken: timeTaken,
//     });
//   }
// }

// // Start processing the image
// processImage(workerData.url, workerData.index, workerData.outputDir);

const fs = require("fs");
const path = require("path");
const sharp = require("sharp"); // Assuming you're using sharp for image resizing

const { workerData, parentPort } = require("worker_threads");

const { url, index, outputDir } = workerData;

async function processImage() {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image from ${url}`);
    const buffer = await response.buffer();

    const outputFilePath = path.join(outputDir, `resized_${index}.jpg`);
    await sharp(buffer)
      .resize(200, 200) // Resize to 200x200 (example)
      .toFile(outputFilePath);

    console.log(`Processed image ${index}, saved to ${outputFilePath}`);
    parentPort.postMessage({ filePath: outputFilePath });
  } catch (error) {
    console.error(`Error processing image ${index}:`, error.message);
    parentPort.postMessage({ error: error.message });
  }
}

processImage();
