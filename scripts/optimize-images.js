#!/usr/bin/env node
// Image optimization script for production builds
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const QUALITY = 80;
const PROGRESSIVE = true;

// Responsive breakpoints
const BREAKPOINTS = [320, 640, 1024, 1920];

async function optimizeImages() {
    console.log('🖼️  Starting image optimization...');
    
    try {
        // Find all images in the project
        const imageFiles = await findImages(['./icons', './images', './assets']);
        
        if (imageFiles.length === 0) {
            console.log('No images found to optimize.');
            return;
        }
        
        console.log(`Found ${imageFiles.length} images to optimize`);
        
        let totalOriginalSize = 0;
        let totalOptimizedSize = 0;
        
        // Process images in batches to avoid memory issues
        const batchSize = 5;
        for (let i = 0; i < imageFiles.length; i += batchSize) {
            const batch = imageFiles.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(processImage)
            );
            
            for (const result of results) {
                if (result) {
                    totalOriginalSize += result.originalSize;
                    totalOptimizedSize += result.optimizedSize;
                }
            }
        }
        
        const savings = totalOriginalSize - totalOptimizedSize;
        const percentage = (savings / totalOriginalSize * 100).toFixed(1);
        
        console.log(`✅ Image optimization complete!`);
        console.log(`Original size: ${formatBytes(totalOriginalSize)}`);
        console.log(`Optimized size: ${formatBytes(totalOptimizedSize)}`);
        console.log(`Saved: ${formatBytes(savings)} (${percentage}%)`);
        
    } catch (error) {
        console.error('❌ Image optimization failed:', error);
        process.exit(1);
    }
}

async function findImages(directories) {
    const images = [];
    
    for (const dir of directories) {
        try {
            const files = await fs.readdir(dir, { recursive: true });
            
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const ext = path.extname(file).toLowerCase();
                
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    const stat = await fs.stat(fullPath);
                    if (stat.isFile()) {
                        images.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory might not exist, skip
            console.log(`Skipping directory ${dir}: ${error.message}`);
        }
    }
    
    return images;
}

async function processImage(imagePath) {
    try {
        const originalStats = await fs.stat(imagePath);
        const originalSize = originalStats.size;
        
        console.log(`Optimizing ${imagePath}...`);
        
        // Get image info
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        
        const ext = path.extname(imagePath).toLowerCase();
        const basename = path.basename(imagePath, ext);
        const dirname = path.dirname(imagePath);
        
        let totalOptimizedSize = 0;
        
        // Generate responsive versions
        for (const width of BREAKPOINTS) {
            if (width < metadata.width) {
                await generateResponsiveImage(image, dirname, basename, ext, width);
            }
        }
        
        // Optimize original image
        let optimizedImage = sharp(imagePath);
        
        if (ext === '.jpg' || ext === '.jpeg') {
            optimizedImage = optimizedImage.jpeg({
                quality: QUALITY,
                progressive: PROGRESSIVE,
                mozjpeg: true
            });
        } else if (ext === '.png') {
            optimizedImage = optimizedImage.png({
                quality: QUALITY,
                compressionLevel: 9,
                palette: true
            });
        } else if (ext === '.webp') {
            optimizedImage = optimizedImage.webp({
                quality: QUALITY,
                effort: 6
            });
        }
        
        // Write optimized original
        const outputPath = imagePath;
        await optimizedImage.toFile(outputPath + '.tmp');
        
        const optimizedStats = await fs.stat(outputPath + '.tmp');
        totalOptimizedSize += optimizedStats.size;
        
        // Replace original if smaller
        if (optimizedStats.size < originalSize) {
            await fs.rename(outputPath + '.tmp', outputPath);
        } else {
            await fs.unlink(outputPath + '.tmp');
            totalOptimizedSize = originalSize;
        }
        
        return {
            path: imagePath,
            originalSize,
            optimizedSize: totalOptimizedSize
        };
        
    } catch (error) {
        console.error(`Failed to optimize ${imagePath}:`, error.message);
        return null;
    }
}

async function generateResponsiveImage(image, dirname, basename, ext, width) {
    const outputPath = path.join(dirname, `${basename}-${width}w${ext}`);
    
    try {
        let resizedImage = image.clone().resize(width);
        
        if (ext === '.jpg' || ext === '.jpeg') {
            resizedImage = resizedImage.jpeg({
                quality: QUALITY,
                progressive: PROGRESSIVE,
                mozjpeg: true
            });
        } else if (ext === '.png') {
            resizedImage = resizedImage.png({
                quality: QUALITY,
                compressionLevel: 9
            });
        }
        
        await resizedImage.toFile(outputPath);
        
    } catch (error) {
        console.error(`Failed to generate responsive image ${outputPath}:`, error.message);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run if called directly
if (require.main === module) {
    optimizeImages();
}

module.exports = { optimizeImages };