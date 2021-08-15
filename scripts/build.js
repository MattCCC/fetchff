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

// Remove all dirs initially
try {
    fs.rmSync(path.resolve('dist'), { recursive: true });
} catch (error) {
}

try {
    fs.rmSync(path.resolve('dist-node'), { recursive: true });
} catch (error) {
}

try {
    fs.rmSync(path.resolve('dist-browser'), { recursive: true });
} catch (error) {
}

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

// Ok, now it's going to be weird
// Let me explain...
// Each build (browser and node) contains its own typings
// but this does not make sense, as both typings are exactly the same
// that's why we are disposing one set of typings (node's typings)
// and only use the typings generated along with the browser build
// therefore a lot of weird copying and moving is done here...sorry...

// moving all node files into folder 'dist-node'
// reason: we want to get rid of all typings
moveFile('dist', 'dist-node', 'index.cjs.development.js');
moveFile('dist', 'dist-node', 'index.cjs.development.js.map');
moveFile('dist', 'dist-node', 'index.cjs.production.min.js');
moveFile('dist', 'dist-node', 'index.cjs.production.min.js.map');
moveFile('dist', 'dist-node', 'index.js');

// finally we delete the folder with all node-typings
fs.rmSync(path.resolve('dist'), { recursive: true });
// now we can move 'dist-node' to 'dist/node' again
fs.mkdirSync(path.resolve('dist'));
moveFile('dist-node', 'dist/node');

// for our browser version, we create a new folder
fs.mkdirSync(path.resolve('dist', 'browser'));
// moving the important files into 'dist/browser' folder
moveFile('dist-browser', 'dist/browser', 'index.esm.js');
moveFile('dist-browser', 'dist/browser', 'index.esm.js.map');

// typings remain in the temporary folder
// therefore we move and rename it to 'dist/types'
moveFile('dist-browser', 'dist/typings');

// now what's left is copying a template typings file into our subfolders
// that's responsible for linking to folder 'dist/types'
fs.copyFileSync(
    path.resolve('scripts/templates', 'index.d.ts'),
    path.resolve('dist', 'browser', 'index.d.ts'),
);

fs.copyFileSync(
    path.resolve('scripts/templates', 'index.d.ts'),
    path.resolve('dist', 'node', 'index.d.ts'),
);

// Avoid unnecessary nested types/ dir
proc.execSync('mv ./dist/typings/* ./dist/; rmdir ./dist/typings/');

console.log('Build finished!');
