#!/usr/bin/env node
/**
 * Post-build script to inject Google AdSense script into all HTML files
 */
const fs = require('fs');
const path = require('path');

const ADSENSE_SCRIPT = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9679910712332333" crossorigin="anonymous"></script>`;

function injectAdSenseScript(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf-8');
  
  // Check if the AdSense script with this specific client ID is already injected
  if (html.includes('ca-pub-9679910712332333')) {
    console.log(`✓ AdSense already present in: ${htmlPath}`);
    return;
  }
  
  // Inject the script right after <head> tag (case-insensitive)
  html = html.replace(/(<head[^>]*>)/i, `$1\n${ADSENSE_SCRIPT}`);
  
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`✓ Injected AdSense into: ${htmlPath}`);
}

function findHtmlFiles(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findHtmlFiles(filePath);
    } else if (file.endsWith('.html')) {
      injectAdSenseScript(filePath);
    }
  });
}

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Please build the project first.');
  process.exit(1);
}

console.log('Injecting Google AdSense script into HTML files...');
findHtmlFiles(distDir);
console.log('Done!');
