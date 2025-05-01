// Sun Study Heat Map Generator
// This sketch analyzes multiple images to create a composite heatmap
// showing sun exposure patterns across the images

let images = []; // Array to store loaded images
const totalImages = 90; // Number of images to analyze
let heatMap; // Final composite heat map
let loaded = 0; // Counter for loaded images
let threshold = 200; // Brightness threshold (0-255) to determine sunny vs shady

function preload() {
  // Preload all images
  for (let i = 1; i <= totalImages; i++) {
    // Assuming images are named image1.jpg, image2.jpg, etc.
    // let img = loadImage(`images/image${i}.jpg`, 
    let img = loadImage(`images/3/1212Garfield_SU_${i}.png`, 
      // Success callback
      () => { loaded++; },
      // Error callback 
      () => { console.error(`Failed to load image${i}.jpg`); }
    );
    images.push(img);
  }
}

function setup() {
  // Create canvas with size of the first image
  // Note: This assumes all images are the same size
  createCanvas(images[0].width, images[0].height);
  
  // Create heatmap image with same dimensions
  heatMap = createImage(width, height);
  
  // Generate the heat map
  generateHeatMap();
  
  // Display information
  console.log(`Analyzed ${totalImages} images`);
  console.log('White pixels: Sunny in all images');
  console.log('Black pixels: Shady in all images');
  console.log('Gray values: Number of sunny hours (from 1 to ' + (totalImages-1) + ')');
}

function draw() {
  // Display the heat map
  image(heatMap, 0, 0);
  
  // Show loading status if not all images are loaded
  if (loaded < totalImages) {
    fill(255);
    rect(10, 10, 200, 30);
    fill(0);
    textSize(16);
    text(`Loading: ${loaded}/${totalImages}`, 20, 30);
  } else {
    // Show legend when fully loaded
    drawLegend();
    
    // Display hover information
    if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
      displayHoverInfo();
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
    // Map y position to sunny hours (from totalImages to 0)
    let sunnyHours = map(y, 0, legendHeight, totalImages, 0);
    // Map sunny hours to grayscale value
    let val = map(sunnyHours, 0, totalImages, 0, 255);
    
    fill(val);
    noStroke();
    rect(startX, startY + y, legendWidth, 1);
  }
  
  // Draw labels
  fill(0);
  textSize(12);
  textAlign(RIGHT, CENTER);
  
  // Top label (always sunny)
  text(`${totalImages} hours of sun`, startX - 5, startY);
  
  // Middle labels
  for (let i = 1; i < totalImages; i++) {
    if (i % 2 === 0 || totalImages <= 6) { // Only show even numbers if many images
      let y = map(i, totalImages, 0, startY, startY + legendHeight);
      text(`${totalImages - i} hours`, startX - 5, y);
    }
  }
  
  // Bottom label (never sunny)
  text("0 hours of sun", startX - 5, startY + legendHeight);
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
  
  // Display info box
  fill(255, 255, 255, 220);
  stroke(0);
  rect(boxX, boxY, boxWidth, boxHeight);
  
  // Display text inside the box
  noStroke();
  fill(0);
  text(`Sun Hours: ${daylightHours.toFixed(1)}/${totalImages}`, boxX + 10, boxY + 12);
  text(`Daylight: ${daylightPercentage.toFixed(1)}%`, boxX + 10, boxY + 28);
  
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
  }
}