////////////////////////////////
// Setup
////////////////////////////////

// Gulp and package
const { src, dest, parallel, series, watch } = require("gulp");
const pjson = require("./package.json");

// Plugins
const autoprefixer = require("autoprefixer");
const browserSync = require("browser-sync").create();

const cssnano = require("cssnano");
const imagemin = require("gulp-imagemin");
const pixrem = require("pixrem");
const plumber = require("gulp-plumber");
const postcss = require("gulp-postcss");
const reload = browserSync.reload;
const rename = require("gulp-rename");
const sass = require("gulp-sass");
const spawn = require("child_process").spawn;
const uglify = require("gulp-uglify-es").default;

// Relative paths function
function pathsConfig(appName) {
  this.app = `./${pjson.name}`;
  this.config = `./config`;
  const vendorsRoot = "node_modules";

  return {
    app: this.app,
    config: this.config,
    templates: `${this.app}/templates`,
    css: `${this.app}/static/css`,
    sass: `${this.app}/static/sass`,
    fonts: `${this.app}/static/fonts`,
    images: `${this.app}/static/images`,
    js: `${this.app}/static/js`,
  };
}

var paths = pathsConfig();

////////////////////////////////
// Tasks
////////////////////////////////

// Styles autoprefixing and minification
function styles() {
  var processCss = [
    autoprefixer(), // adds vendor prefixes
    pixrem(), // add fallbacks for rem units
  ];

  var minifyCss = [
    cssnano({ preset: "default" }), // minify result
  ];

  return src([
    `${paths.sass}/project.scss`,
    `${paths.sass}/account.scss`,
    `${paths.sass}/default.scss`,
  ])
    .pipe(
      sass({
        includePaths: [paths.sass],
      }).on("error", sass.logError)
    )
    .pipe(plumber()) // Checks for errors
    .pipe(postcss(processCss))
    .pipe(dest(paths.css))
    .pipe(rename({ suffix: ".min" }))
    .pipe(postcss(minifyCss)) // Minifies the result
    .pipe(dest(paths.css));
}

// Javascript minification
function scripts() {
  return src([
    `${paths.js}/project.js`,
    `${paths.js}/functions.js`,
    `${paths.js}/processAjax.js`,
  ])
    .pipe(plumber()) // Checks for errors
    .pipe(uglify()) // Minifies the js
    .pipe(rename({ suffix: ".min" }))
    .pipe(dest(paths.js));
}

// Image compression
function imgCompression() {
  return src(`${paths.images}/*`)
    .pipe(imagemin()) // Compresses PNG, JPEG, GIF and SVG images
    .pipe(dest(paths.images));
}

// Run django server
function runServer(cb) {
  var cmd = spawn("python", ["manage.py", "runserver", "0.0.0.0:3000"], { stdio: "inherit" });
  cmd.on("close", function (code) {
    console.log("runServer exited with code " + code);
    cb(code);
  });
}

// Browser sync server for live reload
function initBrowserSync() {
  browserSync.init(
    [`${paths.css}/*.css`, `${paths.js}/*.js`, `${paths.templates}/*.html`],
    {
      // https://www.browsersync.io/docs/options/#option-proxy
      proxy: {
        target: "django:8080",
        proxyReq: [
          function (proxyReq, req) {
            // Assign proxy "host" header same as current request at Browsersync server
            proxyReq.setHeader("Host", req.headers.host);
          },
        ],
      },
      // https://www.browsersync.io/docs/options/#option-open
      // Disable as it doesn't work from inside a container
      open: false,
    }
  );
}

// Delay watch
function debounce(fn, delay) {
  var timer = null;
  return function () {
    var context = this,
      args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}

// Watch
function watchPaths() {
  watch(`${paths.sass}/*.scss`, { usePolling: true }, styles);
  watch(`${paths.templates}/**/*.html`, { usePolling: true }).on(
    "change",
    reload
  );
  watch(
    [`${paths.js}/*.js`, `!${paths.js}/*.min.js`],
    { usePolling: true },
    scripts
  ).on("change", reload);
}

// Generate all assets
const generateAssets = parallel(
  styles,
  scripts,

  imgCompression
);

// Set up dev environment
const dev = parallel(initBrowserSync, watchPaths, runServer);

exports.default = series(generateAssets, dev);
exports["generate-assets"] = generateAssets;
exports["dev"] = dev;
