#!/usr/bin/env node
/**
 * Post-build script to inject Google AdSense script into all HTML files
 */
const fs = require('fs');
const path = require('path');

const ADSENSE_SCRIPT = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9679910712332333"
     crossorigin="anonymous"></script>`;
const ADSENSE_META = `<meta name="google-adsense-account" content="ca-pub-9679910712332333">`;
const GOOGLE_SITE_VERIFICATION = `<meta name="google-site-verification" content="14RFhI0FXY1YDiIG4D-RC3U27kBT-VYNdOeYDPyncC8" />`;

function injectAdSenseScript(htmlPath) {
  try {
    let html = fs.readFileSync(htmlPath, 'utf-8');
    let modified = false;
    
    // Check and inject AdSense script
    if (!html.includes('ca-pub-9679910712332333')) {
      // Inject the meta tag and script right after <head> tag (case-insensitive)
      html = html.replace(/(<head[^>]*>)/i, `$1\n${ADSENSE_META}\n${ADSENSE_SCRIPT}`);
      modified = true;
    }
    
    // Check and inject Google Site Verification
    if (!html.includes('14RFhI0FXY1YDiIG4D-RC3U27kBT-VYNdOeYDPyncC8')) {
      // Inject the verification meta tag right after <head> tag (case-insensitive)
      html = html.replace(/(<head[^>]*>)/i, `$1\n${GOOGLE_SITE_VERIFICATION}`);
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`✓ Injected meta tags into: ${htmlPath}`);
    } else {
      console.log(`✓ All meta tags already present in: ${htmlPath}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${htmlPath}:`, error.message);
  }
}

function findHtmlFiles(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          findHtmlFiles(filePath);
        } else if (file.endsWith('.html')) {
          injectAdSenseScript(filePath);
        }
      } catch (error) {
        console.error(`✗ Error accessing ${filePath}:`, error.message);
      }
    });
  } catch (error) {
    console.error(`✗ Error reading directory ${dir}:`, error.message);
  }
}

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Please build the project first.');
  process.exit(1);
}

console.log('Injecting Google AdSense and Site Verification meta tags into HTML files...');
findHtmlFiles(distDir);
console.log('Done!');
