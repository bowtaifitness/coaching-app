#!/usr/bin/env node

/**
 * Icon Generator for Birdies App
 * Creates properly scaled and centered icons for iOS and Android
 * Run with: node create-icons.js
 */

const fs = require('fs');
const path = require('path');

// This is a simple HTML file generator that creates icons in the browser
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Generate Birdies Icons</title>
    <style>
        body {
            font-family: system-ui;
            max-width: 1200px;
            margin: 40px auto;
            padding: 20px;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #059669; margin-bottom: 30px; }
        .alert {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .success {
            background: #d1fae5;
            border-left: 4px solid #059669;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            display: none;
        }
        .controls {
            background: #f9fafb;
            padding: 30px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .slider-container {
            display: flex;
            align-items: center;
            gap: 20px;
            margin: 20px 0;
        }
        input[type="range"] {
            flex: 1;
            height: 8px;
        }
        .value {
            font-size: 32px;
            font-weight: bold;
            color: #059669;
            min-width: 90px;
            text-align: center;
        }
        .preview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
            margin: 30px 0;
        }
        .preview-card {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #e5e7eb;
        }
        .preview-card:hover {
            border-color: #059669;
        }
        canvas {
            border-radius: 22%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 100%;
            background: white;
            margin: 15px 0;
        }
        button {
            background: #059669;
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin: 10px 5px;
            transition: all 0.2s;
        }
        button:hover {
            background: #047857;
            transform: translateY(-2px);
        }
        .download-all {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-size: 18px;
            padding: 18px 36px;
        }
        .instructions {
            background: #eff6ff;
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
        }
        .instructions ol {
            margin-left: 20px;
            line-height: 1.8;
        }
        code {
            background: #e5e7eb;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏌️ Birdies Icon Generator - Fix iOS Cropping</h1>

        <div class="alert">
            <h3>⚠️ The Problem</h3>
            <p><strong>Your icons are currently using the raw source image (BirdieOnluy_White.png) which has the birdie and golf ball too close to the edges.</strong></p>
            <p>iOS applies an automatic circular mask that crops approximately 12-15% from each edge. We need to create new icon files with the logo scaled down and centered.</p>
        </div>

        <div class="controls">
            <h2 style="margin-bottom: 15px;">Icon Scale Settings</h2>
            <p style="color: #6b7280; margin-bottom: 15px;">Adjust how much of the icon space the logo fills. Lower = more white space = safer from cropping.</p>

            <div class="slider-container">
                <label style="font-weight: 600; min-width: 120px;">Logo Scale:</label>
                <input type="range" id="scale" min="40" max="70" value="55" step="1">
                <span class="value" id="scaleValue">55%</span>
            </div>

            <p style="color: #059669; font-weight: 600; margin-top: 15px;">
                ✓ Recommended: 55% (default) - Safe for all iOS devices<br>
                ✓ If still cropping: Try 50% or 45%
            </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <button class="download-all" onclick="downloadAll()">
                ⬇️ Download All Icon Files
            </button>
        </div>

        <div class="success" id="successMsg">
            <h3>✅ Icons Downloaded!</h3>
            <p>Check your Downloads folder. Now follow the installation steps below.</p>
        </div>

        <div class="preview-grid">
            <div class="preview-card">
                <h3>Apple Touch Icon</h3>
                <p style="color: #6b7280; font-size: 14px;">180×180 (iOS Home Screen)</p>
                <canvas id="canvas180" width="180" height="180"></canvas>
                <button onclick="downloadIcon(180, 'apple-touch-icon.png')">Download</button>
            </div>

            <div class="preview-card">
                <h3>Android Standard</h3>
                <p style="color: #6b7280; font-size: 14px;">192×192</p>
                <canvas id="canvas192" width="192" height="192"></canvas>
                <button onclick="downloadIcon(192, 'icon-192.png')">Download</button>
            </div>

            <div class="preview-card">
                <h3>Android High-Res</h3>
                <p style="color: #6b7280; font-size: 14px;">512×512</p>
                <canvas id="canvas512" width="512" height="512"></canvas>
                <button onclick="downloadIcon(512, 'icon-512.png')">Download</button>
            </div>

            <div class="preview-card">
                <h3>High Resolution</h3>
                <p style="color: #6b7280; font-size: 14px;">1024×1024</p>
                <canvas id="canvas1024" width="1024" height="1024" style="max-width: 200px;"></canvas>
                <button onclick="downloadIcon(1024, 'icon-1024.png')">Download</button>
            </div>
        </div>

        <div class="instructions">
            <h3>📋 Installation Steps</h3>
            <ol>
                <li>Click "Download All Icon Files" button above</li>
                <li>Locate the downloaded files in your Downloads folder</li>
                <li>Copy these files to your <code>/public</code> folder, replacing any existing files:
                    <ul>
                        <li><code>apple-touch-icon.png</code> (most important for iOS!)</li>
                        <li><code>icon-192.png</code></li>
                        <li><code>icon-512.png</code></li>
                        <li><code>icon-1024.png</code> (optional)</li>
                    </ul>
                </li>
                <li>Rebuild your app: <code>npm run build</code></li>
                <li>Clear browser cache (Cmd+Shift+R on Mac)</li>
                <li><strong>On iOS:</strong> Delete the app from home screen, then reinstall from Safari</li>
                <li>Test: The icon should now be centered with no cropping!</li>
            </ol>
        </div>
    </div>

    <script>
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = function() {
            console.log('✅ Image loaded:', img.width, 'x', img.height);
            drawAllIcons();
        };

        img.onerror = function() {
            alert('❌ Failed to load BirdieOnluy_White.png\\n\\nMake sure this file exists in your /public folder and the server is running.');
        };

        img.src = '/BirdieOnluy_White.png';

        const scaleInput = document.getElementById('scale');
        const scaleValue = document.getElementById('scaleValue');

        scaleInput.addEventListener('input', function(e) {
            scaleValue.textContent = e.target.value + '%';
            drawAllIcons();
        });

        function drawAllIcons() {
            [180, 192, 512, 1024].forEach(size => drawIcon(size));
        }

        function drawIcon(size) {
            const canvas = document.getElementById(\`canvas\${size}\`);
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const scale = parseInt(scaleInput.value) / 100;

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            // Calculate centered position
            const logoSize = size * scale;
            const offset = (size - logoSize) / 2;

            // High quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw centered logo
            ctx.drawImage(img, offset, offset, logoSize, logoSize);
        }

        function downloadIcon(size, filename) {
            const canvas = document.getElementById(\`canvas\${size}\`);
            if (!canvas) return;

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();

            console.log('✅ Downloaded:', filename);
        }

        function downloadAll() {
            const files = [
                { size: 180, name: 'apple-touch-icon.png' },
                { size: 192, name: 'icon-192.png' },
                { size: 512, name: 'icon-512.png' },
                { size: 1024, name: 'icon-1024.png' }
            ];

            files.forEach((file, i) => {
                setTimeout(() => downloadIcon(file.size, file.name), i * 250);
            });

            setTimeout(() => {
                document.getElementById('successMsg').style.display = 'block';
                document.getElementById('successMsg').scrollIntoView({ behavior: 'smooth' });
            }, 1200);
        }
    </script>
</body>
</html>`;

// Write to public folder
const outputPath = path.join(__dirname, 'public', 'icon-generator.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log('✅ Icon generator created at: public/icon-generator.html');
console.log('');
console.log('📋 Next steps:');
console.log('1. Start your dev server: npm run dev');
console.log('2. Open: http://localhost:5173/icon-generator.html');
console.log('3. Download all icon files');
console.log('4. Replace files in /public folder');
console.log('5. Rebuild and test!');
