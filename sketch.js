// Sun Study Heat Map Generator
// This sketch analyzes multiple images to create a composite heatmap
// showing sun exposure patterns across the images

let images = []; // Array to store loaded images
const totalImages = 90; // Number of images to analyze
let heatMap; // Final composite heat map
let loaded = 0; // Counter for loaded images
let threshold = 200; // Brightness threshold (0-255) to determine sunny vs shady

// Calculate scale: 19' = 192 pixels, so 1' = 192 / 19 pixels
const scale = 192 / 19;

// Set initial rectangle dimensions based on scale
let rectWidth = 8 * scale; // 8' in pixels
let rectHeight = 4 * scale; // 4' in pixels
let isVertical = true;

let permanentRectangles = []; // Store permanent rectangles and their scores

let loadingBar; // HTML element for the loading bar
let loadingText; // HTML element for the loading text
let isLoading = true; // Track loading state

function setup() {
  // Create canvas
  createCanvas(800, 600); // Temporary size until images are loaded

  // Create loading bar and text
  loadingBar = createDiv('').style('width', '0%').style('height', '20px').style('background', 'green');
  loadingText = createDiv('Loading: 0%').style('margin-top', '5px').style('text-align', 'center').style('color', 'white');
  let loadingContainer = createDiv('').style('width', '60%').style('margin', 'auto').style('margin-top', '20px').style('background', 'gray');
  loadingContainer.child(loadingBar);
  loadingContainer.child(loadingText);

  // Start loading images
  loadImages();
}

function loadImages() {
  for (let i = 1; i <= totalImages; i++) {
    let img = loadImage(
      `images/3/1212Garfield_SU_${i}.png`,
      // Success callback
      () => {
        loaded++;
        updateLoadingBar();
        if (loaded === totalImages) {
          // All images loaded
          isLoading = false;
          loadingBar.remove();
          loadingText.remove();

          // Resize canvas to match image dimensions
          resizeCanvas(images[0].width, images[0].height);

          // Create heatmap image with same dimensions
          heatMap = createImage(width, height);

          // Generate the heat map
          generateHeatMap();
        }
      },
      // Error callback
      () => { console.error(`Failed to load image${i}.png`); }
    );
    images.push(img);
  }
}

function updateLoadingBar() {
  // Update the loading bar and text
  let progress = (loaded / totalImages) * 100;
  loadingBar.style('width', `${progress}%`);
  loadingText.html(`Loading: ${Math.floor(progress)}%`);
}

function draw() {
  if (isLoading) {
    // Display loading screen
    background(50);
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text('Loading images, please wait...', width / 2, height / 2);
  } else {
    // Display the heat map
    image(heatMap, 0, 0);

    // Show legend when fully loaded
    drawLegend();

    // Display hover information
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      displayHoverInfo();
    }

    // Draw a rectangle centered on the cursor
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      noFill();
      stroke(0, 255, 0); // Green outline
      rect(mouseX - rectWidth / 2, mouseY - rectHeight / 2, rectWidth, rectHeight);

      // Calculate the score and daylight percentage for the rectangle at the mouse position
      let score = calculateRectangleScore(mouseX, mouseY, rectWidth, rectHeight);
      let daylightPercentage = map(score / (rectWidth * rectHeight), 0, 255, 0, 100);

      // Display the score and daylight percentage at the mouse cursor
      fill(255, 255, 255, 220);
      stroke(0);
      rect(mouseX + 10, mouseY - 30, 120, 40); // Background for text
      noStroke();
      fill(0);
      textSize(12);
      textAlign(LEFT, CENTER);
      text(`Daylight: ${daylightPercentage.toFixed(1)}%`, mouseX + 15, mouseY - 20);
      text(`Score: ${score.toFixed(0)}`, mouseX + 15, mouseY - 5);
    }

    // Draw all permanent rectangles with their scores
    for (let garden of permanentRectangles) {
      noFill();
      stroke(255, 0, 0); // Red outline for permanent rectangles
      rect(garden.x - garden.w / 2, garden.y - garden.h / 2, garden.w, garden.h);
      fill(255, 255, 255, 200); // Semi-transparent background for text
      noStroke();
      textSize(12);
      textAlign(CENTER, CENTER);
      text(`Score: ${garden.score}`, garden.x, garden.y);
    }
  }
}

function generateHeatMap() {
  // Load all pixels for processing
  heatMap.loadPixels();
  images.forEach(img => img.loadPixels());

  // Analyze each pixel across all images
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let index = (x + y * width) * 4;

      // Count how many images have this pixel as "sunny"
      let sunnyCount = 0;

      for (let i = 0; i < images.length; i++) {
        // Get brightness of this pixel in this image
        let imgIndex = (x + y * images[i].width) * 4;
        let r = images[i].pixels[imgIndex];
        let g = images[i].pixels[imgIndex + 1];
        let b = images[i].pixels[imgIndex + 2];

        // Calculate perceived brightness (weighted RGB)
        let brightness = (0.299 * r + 0.587 * g + 0.114 * b);

        // Check if pixel is sunny (brighter than threshold)
        if (brightness > threshold) {
          sunnyCount++;
        }
      }

      // Map sunnyCount to a grayscale value
      // 0 = black (never sunny)
      // totalImages = white (always sunny)
      // Values in between = varying levels of gray
      let sunValue = map(sunnyCount, 0, totalImages, 0, 255);

      // Set the pixel in the heat map
      heatMap.pixels[index] = sunValue;     // R
      heatMap.pixels[index + 1] = sunValue; // G
      heatMap.pixels[index + 2] = sunValue; // B
      heatMap.pixels[index + 3] = 255;      // Alpha (fully opaque)
    }
  }

  // Update the heat map with new pixel values
  heatMap.updatePixels();
}

function drawLegend() {
  const legendWidth = 20;
  const legendHeight = height * 0.8;
  const startX = width - legendWidth - 20;
  const startY = height * 0.1;

  // Draw legend gradient
  for (let y = 0; y < legendHeight; y++) {
    // Map y position to percentage (0% to 100%)
    let percentage = map(y, 0, legendHeight, 100, 0);
    let val = map(percentage, 0, 100, 0, 255); // Map percentage to grayscale value

    fill(val);
    noStroke();
    rect(startX, startY + y, legendWidth, 1);
  }

  // Draw labels
  fill(0);
  textSize(12);
  textAlign(RIGHT, CENTER);

  // Add percentage labels (0% to 100%)
  for (let i = 0; i <= 10; i++) {
    let percentage = i * 10; // 0%, 10%, ..., 100%
    let y = map(percentage, 0, 100, startY + legendHeight, startY);
    text(`${percentage}%`, startX - 5, y);
  }
}

// Function to display hover information
function displayHoverInfo() {
  // Get the mouse position
  const x = mouseX;
  const y = mouseY;

  // Get the pixel color at mouse position
  heatMap.loadPixels();
  const index = (x + y * width) * 4;
  const pixelBrightness = heatMap.pixels[index];

  // Calculate percentage of daylight
  const daylightHours = map(pixelBrightness, 0, 255, 0, totalImages);
  const daylightPercentage = (daylightHours / totalImages) * 100;

  // Set text properties first to measure width
  textSize(12);
  textAlign(LEFT, CENTER);

  // Determine box dimensions based on text content
  const boxWidth = 160;
  const boxHeight = 38;

  // Position box to stay within canvas
  let boxX = x + 15;
  let boxY = y - 40;

  // Make sure box doesn't go off right edge
  if (boxX + boxWidth > width) {
    boxX = x - boxWidth - 15;
  }

  // Make sure box doesn't go off top edge
  if (boxY < 5) {
    boxY = 5;
  }

  // Draw a small crosshair at the pixel
  stroke(255, 0, 0);
  line(x - 5, y, x + 5, y);
  line(x, y - 5, x, y + 5);
}

// Optional: Add functionality to adjust threshold via keyboard
function keyPressed() {
  if (keyCode === UP_ARROW) {
    threshold = min(threshold + 10, 255);
    generateHeatMap();
    console.log("Threshold increased to: " + threshold);
  } else if (keyCode === DOWN_ARROW) {
    threshold = max(threshold - 10, 0);
    generateHeatMap();
    console.log("Threshold decreased to: " + threshold);
  } else if (key === 's' || key === 'S') {
    saveCanvas('sun_study_heatmap', 'png');
    console.log("Heatmap saved!");
  } else if (key === ' ') {
    // Flip rectangle orientation
    isVertical = !isVertical;
    [rectWidth, rectHeight] = [rectHeight, rectWidth];
    console.log("Rectangle orientation flipped");
  } else if (key === '+' || key === '=') {
    // Increase rectangle size
    rectWidth += isVertical ? 1 : 2;
    rectHeight += isVertical ? 2 : 1;
    console.log(`Rectangle size increased to: ${rectWidth}x${rectHeight}`);
  } else if (key === '-') {
    // Decrease rectangle size
    rectWidth = max(1, rectWidth - (isVertical ? 1 : 2));
    rectHeight = max(1, rectHeight - (isVertical ? 2 : 1));
    console.log(`Rectangle size decreased to: ${rectWidth}x${rectHeight}`);
  }
}

function mousePressed() {
  // Save the rectangle and its score when the mouse is clicked
  if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
    let score = calculateRectangleScore(mouseX, mouseY, rectWidth, rectHeight);
    permanentRectangles.push({
      x: mouseX,
      y: mouseY,
      w: rectWidth,
      h: rectHeight,
      score: score
    });
    console.log(`Saved rectangle at (${mouseX}, ${mouseY}) with score: ${score}`);
  }
}

function calculateRectangleScore(x, y, w, h) {
  let score = 0;
  heatMap.loadPixels();

  // Iterate over the pixels within the rectangle
  for (let i = floor(x - w / 2); i < floor(x + w / 2); i++) {
    for (let j = floor(y - h / 2); j < floor(y + h / 2); j++) {
      if (i >= 0 && i < width && j >= 0 && j < height) {
        let index = (i + j * width) * 4;
        let brightness = heatMap.pixels[index]; // Grayscale value (0-255)
        score += brightness; // Add brightness to the score
      }
    }
  }

  return score;
}