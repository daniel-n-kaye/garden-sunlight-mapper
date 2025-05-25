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

let isLoading = true; // Track loading state
let loadingStage = 'images'; // 'images' or 'heatmap'

let bestRectangle = null; // Track the best rectangle hovered so far
let movingRectangle = null; // Only the currently "hill climbing" rectangle

function setup() {
  // Create canvas
  createCanvas(1280, 720); // size of dan's images

  // Start loading images
  loadImages();
}

function loadImages() {
  for (let i = 1; i <= totalImages; i++) {
    loadImage(
      `images/3/1212Garfield_SU_${i}.png`,
      // Success callback
      async (img) => {
        images.push(img); // Only push if loaded successfully
        loaded++;
        if (loaded === totalImages) {
          // All images loaded
          // Check if at least one image loaded
          if (images.length > 0 && images[0]) {
            resizeCanvas(images[0].width, images[0].height);

            // Create heatmap image with same dimensions
            heatMap = createImage(width, height);

            // Start generating the heat map asynchronously, don't await
            isLoading = true;
            loadingStage = 'heatmap';
            generateHeatMap().then(() => {
              isLoading = false;
              redraw();
            });
          } else {
            createP('No images loaded. Please check your image paths.').style('color', 'red');
            isLoading = false;
          }
        }
      },
      // Error callback
      () => {
        loaded++;
        // Don't push undefined images
        console.error(`Failed to load image ${i}.png`);
        // If all attempted, still remove loading UI
        if (loaded === totalImages) {
          if (images.length > 0 && images[0]) {
            resizeCanvas(images[0].width, images[0].height);
            heatMap = createImage(width, height);
            isLoading = true;
            loadingStage = 'heatmap';
            generateHeatMap().then(() => {
              isLoading = false;
              redraw();
            });
          } else {
            createP('No images loaded. Please check your image paths.').style('color', 'red');
            isLoading = false;
          }
        }
      }
    );
  }
}

function draw() {
  if (isLoading) {
    // Draw animated loading screen on canvas
    background(50, 80, 60);
    // Animate grow value endlessly back and forth using sine wave (continuous)
    let grow = 0.6 + 0.4 * sin(frameCount * 0.08); // range: 0.2 to 1.0, oscillates forever
    drawLoadingAnimation(grow);
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    let loadingText = loadingStage === 'images' ? 'Loading images...' : 'Generating heatmap...';
    text(loadingText, width / 2, height * 0.8);
  } else if (heatMap) { // Only draw if heatMap is defined
    // Display the heat map
    image(heatMap, 0, 0);

    // Show legend when fully loaded
    drawLegend();

    // Display hover information
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      displayHoverInfo();
    }

    // Draw a rectangle centered above the cursor (with offset for text visibility)
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      // Offset so rectangle is just above the cursor, and text is centered in the rect
      const rectYOffset = -rectHeight / 2 - 8; // 8px above cursor, less than before

      noFill();
      // Light green for placing phase (matches loading screen leaf)
      stroke(60, 180, 90); // Light green
      strokeWeight(3);
      rect(mouseX - rectWidth / 2, mouseY + rectYOffset - rectHeight / 2, rectWidth, rectHeight);
      strokeWeight(1);

      // Calculate the score and daylight percentage for the rectangle at the mouse position
      let score = calculateRectangleScore(mouseX, mouseY + rectYOffset, rectWidth, rectHeight);
      let daylightPercentage = map(score / (rectWidth * rectHeight), 0, 255, 0, 100);

      // Centered % daylight, centered in the rectangle
      fill(0);
      noStroke();
      textSize(14);
      textAlign(CENTER, CENTER);
      text(`${daylightPercentage.toFixed(2)}%`, mouseX, mouseY + rectYOffset);
    }

    // Track best rectangle as mouse moves
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      // Calculate the score for the current rectangle
      const rectYOffset = -rectHeight / 2 - 8;
      let score = calculateRectangleScore(mouseX, mouseY + rectYOffset, rectWidth, rectHeight);

      // If this is the best score so far, update bestRectangle
      if (!bestRectangle || score > bestRectangle.score) {
        bestRectangle = {
          x: mouseX,
          y: mouseY + rectYOffset,
          w: rectWidth,
          h: rectHeight,
          score: score
        };
      }
    }

    // Hill climbing for the moving rectangle
    if (movingRectangle && movingRectangle.searching) {
      let directions = [
        {dx: 0, dy: -1},   // N
        {dx: 1, dy: -1},   // NE
        {dx: 1, dy: 0},    // E
        {dx: 1, dy: 1},    // SE
        {dx: 0, dy: 1},    // S
        {dx: -1, dy: 1},   // SW
        {dx: -1, dy: 0},   // W
        {dx: -1, dy: -1},  // NW
      ];
      let bestScore = movingRectangle.score;
      let bestPos = {x: movingRectangle.x, y: movingRectangle.y};
      for (let dir of directions) {
        let nx = movingRectangle.x + dir.dx;
        let ny = movingRectangle.y + dir.dy;
        if (
          nx - movingRectangle.w / 2 >= 0 &&
          nx + movingRectangle.w / 2 < width &&
          ny - movingRectangle.h / 2 >= 0 &&
          ny + movingRectangle.h / 2 < height
        ) {
          let score = calculateRectangleScore(nx, ny, movingRectangle.w, movingRectangle.h);
          if (score > bestScore) {
            bestScore = score;
            bestPos = {x: nx, y: ny};
          }
        }
      }
      if (bestScore > movingRectangle.score) {
        movingRectangle.x = bestPos.x;
        movingRectangle.y = bestPos.y;
        movingRectangle.score = bestScore;
        // searching remains true
      } else {
        // No better neighbor, stop searching and make it permanent
        movingRectangle.searching = false;
        permanentRectangles.push({...movingRectangle});
        movingRectangle = null;
      }
    }

    // Draw all permanent rectangles with their scores
    for (let garden of permanentRectangles) {
      noFill();
      // Deep forest green for done/best
      stroke(20, 80, 40); // Deep forest green
      strokeWeight(3);
      rect(garden.x - garden.w / 2, garden.y - garden.h / 2, garden.w, garden.h);
      strokeWeight(1);
      fill(0);
      noStroke();
      textSize(14);
      textAlign(CENTER, CENTER);
      // Calculate daylight percentage for this rectangle
      let daylightPercentage = map(garden.score / (garden.w * garden.h), 0, 255, 0, 100);
      text(`${daylightPercentage.toFixed(2)}%`, garden.x, garden.y);
    }

    // Draw the moving rectangle (if it exists)
    if (movingRectangle) {
      noFill();
      // Modern orange for optimizing phase
      stroke(255, 140, 40); // Orange
      strokeWeight(3);
      rect(
        movingRectangle.x - movingRectangle.w / 2,
        movingRectangle.y - movingRectangle.h / 2,
        movingRectangle.w,
        movingRectangle.h
      );
      strokeWeight(1);
      fill(0); // Black text for better contrast
      noStroke();
      textSize(14);
      textAlign(CENTER, CENTER);
      // Calculate daylight percentage for moving rectangle
      let daylightPercentage = map(movingRectangle.score / (movingRectangle.w * movingRectangle.h), 0, 255, 0, 100);
      text(
        `${daylightPercentage.toFixed(2)}%`,
        movingRectangle.x,
        movingRectangle.y
      );
    }
  } else {
    // Optionally, show a message if heatMap is not ready
    background(50);
    fill(255, 0, 0);
    textSize(20);
    textAlign(CENTER, CENTER);
    text('Heatmap not available. Check image loading.', width / 2, height / 2);
  }
}

async function generateHeatMap() {

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
    // Yield to UI every 20 columns to keep loading animation responsive
    if (x % 20 === 0) await new Promise(r => setTimeout(r, 0));
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

  // Removed: Draw a small crosshair at the pixel
  // stroke(255, 0, 0);
  // line(x - 5, y, x + 5, y);
  // line(x, y - 5, x, y + 5);
}

// Optional: Add functionality to adjust threshold via keyboard
function keyPressed() {
  if (key === 's' || key === 'S') {
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
  // Start a new moving rectangle search from the clicked position
  if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
    const rectYOffset = -rectHeight / 2 - 8;
    let score = calculateRectangleScore(mouseX, mouseY + rectYOffset, rectWidth, rectHeight);
    movingRectangle = {
      x: mouseX,
      y: mouseY + rectYOffset,
      w: rectWidth,
      h: rectHeight,
      score: score,
      searching: true
    };
    // Do not push to permanentRectangles here; only after hill climbing is done
    console.log(`Started rectangle search at (${mouseX}, ${mouseY + rectYOffset}) with score: ${score}`);
  }
}

function calculateRectangleScore(x, y, w, h) {
  let score = 0;
  if (!heatMap) return 0; // Prevent error if heatMap is undefined
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

// Draws a smooth animated leaf loading animation based on grow (0-1)
function drawLoadingAnimation(grow) {
  push();
  translate(width / 2, height / 2);

  let numLeaves = 8;
  let maxLeafLength = 75; 
  let maxLeafWidth = 40;

  // Draw rotated leaves
  push();
  let leafRotation = PI / numLeaves;
  rotate(leafRotation);

  for (let i = 0; i < numLeaves; i++) {
    let angle = map(i, 0, numLeaves, 0, TWO_PI);
    let leafGrow = grow * (0.85 + 0.15 * sin(frameCount * 0.06 + i));
    push();
    rotate(angle + sin(frameCount * 0.01 + i) * 0.1);
    drawLeaf(0, 0, maxLeafLength * leafGrow, maxLeafWidth * leafGrow, color(60, 180, 90, 200));
    pop();
  }
  pop();

  // Draw a non-animated, much longer, skinnier stem on top, always vertical
  stroke(60, 120, 60);
  strokeWeight(3);
  line(0, 0, 0, 120);

  pop();
}

// Helper to draw a single leaf shape (no veins)
function drawLeaf(x, y, len, wid, col) {
  fill(col);
  noStroke();
  beginShape();
  vertex(x, y);
  bezierVertex(x - wid / 2, y - len * 0.3, x - wid / 2, y - len * 0.7, x, y - len);
  bezierVertex(x + wid / 2, y - len * 0.7, x + wid / 2, y - len * 0.3, x, y);
  endShape(CLOSE);
}

// Easing function for smooth growth
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}