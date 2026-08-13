const fs = require('fs');
const path = require('path');

function copyDir(src, dst) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
        const srcPath = path.join(src, file);
        const dstPath = path.join(dst, file);
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, dstPath);
        } else {
            fs.copyFileSync(srcPath, dstPath);
        }
    }
}

copyDir('dist', '../web/mobile-app');

// Remove the generated index.html — index.php is maintained manually as a PHP include
const htmlPath = path.join('../web/mobile-app', 'index.html');
if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath);
    console.log('Removed generated index.html (index.php is the PHP include)');
}

console.log('Done: dist/ deployed to web/mobile-app/');
