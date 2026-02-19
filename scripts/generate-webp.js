#!/usr/bin/env node
// WebP generation script for better compression and modern browser support
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png'];
const WEBP_QUALITY = 80;
const WEBP_EFFORT = 6;

async function generateWebPImages() {
    console.log('🌐 Starting WebP image generation...');
    
    try {
        const imageFiles = await findImages(['./icons', './images', './assets']);
        
        if (imageFiles.length === 0) {
            console.log('No images found for WebP conversion.');
            return;
        }
        
        console.log(`Found ${imageFiles.length} images to convert to WebP`);
        
        let totalOriginalSize = 0;
        let totalWebPSize = 0;
        let converted = 0;
        let skipped = 0;
        
        // Process in batches
        const batchSize = 5;
        for (let i = 0; i < imageFiles.length; i += batchSize) {
            const batch = imageFiles.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(convertToWebP)
            );
            
            for (const result of results) {
                if (result) {
                    totalOriginalSize += result.originalSize;
                    totalWebPSize += result.webpSize;
                    converted++;
                } else {
                    skipped++;
                }
            }
        }
        
        const savings = totalOriginalSize - totalWebPSize;
        const percentage = totalOriginalSize > 0 ? 
                          (savings / totalOriginalSize * 100).toFixed(1) : 0;
        
        console.log(`✅ WebP generation complete!`);
        console.log(`Converted: ${converted} images`);
        console.log(`Skipped: ${skipped} images`);
        console.log(`Original size: ${formatBytes(totalOriginalSize)}`);
        console.log(`WebP size: ${formatBytes(totalWebPSize)}`);
        console.log(`Saved: ${formatBytes(savings)} (${percentage}%)`);
        
        // Generate WebP service worker cache manifest
        await generateWebPManifest(imageFiles);
        
    } catch (error) {
        console.error('❌ WebP generation failed:', error);
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
                
                if (SUPPORTED_FORMATS.includes(ext)) {
                    const stat = await fs.stat(fullPath);
                    if (stat.isFile()) {
                        images.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.log(`Skipping directory ${dir}: ${error.message}`);
        }
    }
    
    return images;
}

async function convertToWebP(imagePath) {
    try {
        const ext = path.extname(imagePath);
        const webpPath = imagePath.replace(ext, '.webp');
        
        // Skip if WebP already exists and is newer
        try {
            const [originalStat, webpStat] = await Promise.all([
                fs.stat(imagePath),
                fs.stat(webpPath)
            ]);
            
            if (webpStat.mtime > originalStat.mtime) {
                console.log(`Skipping ${imagePath} (WebP is up to date)`);
                return null;
            }
        } catch (error) {
            // WebP doesn't exist, continue with conversion
        }
        
        console.log(`Converting ${imagePath} to WebP...`);
        
        const originalStats = await fs.stat(imagePath);
        const originalSize = originalStats.size;
        
        // Convert to WebP
        await sharp(imagePath)
            .webp({
                quality: WEBP_QUALITY,
                effort: WEBP_EFFORT,
                lossless: false
            })
            .toFile(webpPath);
        
        const webpStats = await fs.stat(webpPath);
        const webpSize = webpStats.size;
        
        // If WebP is larger than original, remove it
        if (webpSize >= originalSize) {
            await fs.unlink(webpPath);
            console.log(`WebP version of ${imagePath} was larger, removed`);
            return null;
        }
        
        // Generate responsive WebP versions if they don't exist
        await generateResponsiveWebP(imagePath);
        
        return {
            path: imagePath,
            webpPath,
            originalSize,
            webpSize
        };
        
    } catch (error) {
        console.error(`Failed to convert ${imagePath} to WebP:`, error.message);
        return null;
    }
}

async function generateResponsiveWebP(imagePath) {
    const breakpoints = [320, 640, 1024, 1920];
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    
    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        
        for (const width of breakpoints) {
            if (width < metadata.width) {
                const responsiveWebpPath = path.join(dirname, `${basename}-${width}w.webp`);
                
                // Skip if already exists
                try {
                    await fs.access(responsiveWebpPath);
                    continue;
                } catch {
                    // Doesn't exist, create it
                }
                
                await image
                    .clone()
                    .resize(width)
                    .webp({
                        quality: WEBP_QUALITY,
                        effort: WEBP_EFFORT
                    })
                    .toFile(responsiveWebpPath);
            }
        }
    } catch (error) {
        console.error(`Failed to generate responsive WebP for ${imagePath}:`, error.message);
    }
}

async function generateWebPManifest(imageFiles) {
    const manifest = {
        timestamp: new Date().toISOString(),
        images: []
    };
    
    for (const imagePath of imageFiles) {
        const ext = path.extname(imagePath);
        const webpPath = imagePath.replace(ext, '.webp');
        
        try {
            await fs.access(webpPath);
            
            // Add to manifest
            manifest.images.push({
                original: imagePath.replace(/^\.\//, ''),
                webp: webpPath.replace(/^\.\//, ''),
                formats: ['webp', ext.substring(1)]
            });
            
        } catch {
            // WebP doesn't exist, skip
        }
    }
    
    // Write manifest
    const manifestPath = './assets/webp-manifest.json';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`📝 Generated WebP manifest with ${manifest.images.length} entries`);
    
    // Generate CSS for picture elements
    await generatePictureCSS(manifest.images);
}

async function generatePictureCSS(images) {
    let css = '/* Auto-generated WebP CSS */\n\n';
    
    css += '.webp-image {\n';
    css += '  display: block;\n';
    css += '  width: 100%;\n';
    css += '  height: auto;\n';
    css += '}\n\n';
    
    css += '/* WebP support detection */\n';
    css += '.no-webp .webp-fallback { display: block; }\n';
    css += '.webp .webp-fallback { display: none; }\n';
    css += '.no-webp .webp-source { display: none; }\n';
    css += '.webp .webp-source { display: block; }\n\n';
    
    // Responsive image classes
    css += '/* Responsive WebP images */\n';
    css += '@media (max-width: 320px) {\n';
    css += '  .responsive-image { content: url("image-320w.webp"); }\n';
    css += '}\n\n';
    
    css += '@media (max-width: 640px) {\n';
    css += '  .responsive-image { content: url("image-640w.webp"); }\n';
    css += '}\n\n';
    
    css += '@media (max-width: 1024px) {\n';
    css += '  .responsive-image { content: url("image-1024w.webp"); }\n';
    css += '}\n\n';
    
    const cssPath = './assets/webp.css';
    await fs.writeFile(cssPath, css);
    
    console.log('📄 Generated WebP CSS helpers');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// WebP support detection script generation
async function generateWebPDetection() {
    const detectionScript = `
// WebP support detection
(function() {
    var webP = new Image();
    webP.onload = webP.onerror = function() {
        document.documentElement.classList.add(webP.height == 2 ? 'webp' : 'no-webp');
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
})();
`;
    
    await fs.writeFile('./assets/webp-detection.js', detectionScript);
    console.log('🔍 Generated WebP detection script');
}

// Run if called directly
if (require.main === module) {
    generateWebPImages().then(() => {
        return generateWebPDetection();
    });
}

module.exports = { generateWebPImages, generateWebPDetection };