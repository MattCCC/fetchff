// Credit: https://blog.unterholzer.dev/cross-compatible-typescript-libraries/
const proc = require('child_process');
const fs = require('fs');
const path = require('path');

const moveFile = (from, to, filename) => {
    from = from.split('/');
    to = to.split('/');

    if (filename) {
        from.push(filename);
        to.push(filename);
    }

    fs.renameSync(
        path.resolve(...from),
        path.resolve(...to),
    )
}

const removeTempDirs = () => {
    try {
        fs.rmSync(path.resolve('dist-node'), { recursive: true });
    } catch (error) {
    }

    try {
        fs.rmSync(path.resolve('dist-browser'), { recursive: true });
    } catch (error) {
    }
}

// Remove all dirs initially
try {
    fs.rmSync(path.resolve('dist'), { recursive: true });
} catch (error) {
}

removeTempDirs();

console.log('Building browser version...')

// running browser build
// building automatically removes any existing 'dist' folder
proc.execSync('npm run build:browser');

// copying into temporary folder
// so it doesn't get overwritten by next build step
moveFile('dist', 'dist-browser');

console.log('Building node version...')

// running node build
// building automatically removes any existing 'dist' folder
proc.execSync('npm run build:node');

// create temporary folder 'dist-node' where we move our built node files
fs.mkdirSync(path.resolve('dist-node'));

console.log('Creating common types...')

console.log('Handle node...')

// Ok, now it's going to be weird
// Let me explain...
// Each build (browser and node) contains its own typings
// but this does not make sense, as both typings are exactly the same
// that's why we are disposing one set of typings (node's typings)
// and only use the typings generated along with the browser build
// therefore a lot of weird copying and moving is done here...sorry...

// moving all node files into folder 'dist-node'
// reason: we want to get rid of all typings
moveFile('dist', 'dist-node', 'index.js');
moveFile('dist', 'dist-node', 'index.js.map');

// finally we delete the folder with all node-typings
fs.rmSync(path.resolve('dist'), { recursive: true });
// now we can move 'dist-node' to 'dist/node' again
fs.mkdirSync(path.resolve('dist'));

moveFile('dist-node', 'dist/node');

console.log('Handle browser...')

// for our browser version, we create a new folder
fs.mkdirSync(path.resolve('dist', 'browser'));

// Move important files into 'dist/browser' folder
moveFile('dist-browser', 'dist/browser', 'index.mjs');
moveFile('dist-browser', 'dist/browser', 'index.mjs.map');
moveFile('dist-browser', 'dist/browser', 'index.global.js');
moveFile('dist-browser', 'dist/browser', 'index.global.js.map');
moveFile('dist-browser', 'dist/browser', 'index.d.ts');

console.log('Handle typings...')

fs.copyFileSync(
    path.resolve('dist', 'browser', 'index.d.ts'),
    path.resolve('dist', 'node', 'index.d.ts'),
);

fs.copyFileSync(
    path.resolve('dist', 'browser', 'index.d.ts'),
    path.resolve('dist', 'index.d.ts'),
);

removeTempDirs();

console.log('Build finished!');
