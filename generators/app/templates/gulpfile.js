const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const nodemon = require('nodemon');
const gutil = require('gulp-util');
const through = require('through2');
const Cache = require('gulp-file-cache');
const clean = require('gulp-clean');
const cleanDest = require('gulp-clean-dest');
const runSequence = require('run-sequence');
const removeLines = require('gulp-remove-lines');
const concat = require('gulp-concat');
const addsrc = require('gulp-add-src');
const merge2 = require('merge2');
const header = require('gulp-header');
const path = require('path');
const watch = require('gulp-watch');
const plumber = require('gulp-plumber');
const chokidar = require('chokidar');
const fs = require('fs');
const filter = require('gulp-filter');
const combiner = require('stream-combiner2');
const stream = require('stream');
const tsc = require('gulp-typescript');

//
// components
//

const cache = new Cache();

function logFileHelpers(prefix) {
    return through.obj((file, enc, cb) => {
        gutil.log(prefix, gutil.colors.magenta(file.path))
        cb(null, file)
    })
}

function generateDocsPaths() {
    return gulp.src(`${paths.src}/**/paths.yaml`)
        .pipe(removeLines({
            'filters': [
                /^paths:$/
            ]
        }))
        .pipe(concat('paths.yaml'))
        .pipe(header('paths:\n'))
}

function generateDocDefinitions() {
    return gulp.src(`${paths.src}/**/definitions.yaml`)
        .pipe(removeLines({
            'filters': [
                /^definitions:$/
            ]
        }))
        .pipe(concat('definitions.yaml'))
        .pipe(header('definitions:\n'))
}

function generateDoc() {
    merge2(generateDocsPaths(), generateDocDefinitions())
        .pipe(addsrc.prepend(`${paths.src}/docs/index.yaml`))
        .pipe(concat('index.yaml'))
        .pipe(gulp.dest(`${paths.tmp}/swagger-ui`))
}

function cleanWithLog(path) {
    fs.unlink(path, error => {
        if (!error) {
            gutil.log('Delete', gutil.colors.magenta(path))
        } else {
            gutil.log(gutil.colors.red('Failed to delete'), gutil.colors.magenta(path), gutil.colors.red(error))
        }
    })
}

//
// configurations
//

const paths = {
    src: 'src',
    dist: 'dist',
    tmp: 'tmp'
}

//
// tasks
//

gulp.task('clear', ['clear:dev', 'clear:dist'], cb => cb())

gulp.task('clear:dev', ['clear:tmp', 'clear:cache'], cb => cb())
gulp.task('clear:dist', () => gulp.src(paths.dist).pipe(clean({ read: false })))

gulp.task('clear:tmp', () => gulp.src(paths.tmp).pipe(clean()))
gulp.task('clear:cache', () => gulp.src('.gulp-cache').pipe(clean()))


gulp.task('compile', () => {
    return gulp.src(`${paths.src}/**/*.ts`)
        .pipe(tsc({
            module: 'commonjs',
            target: 'es6',
            noImplicitAny: false,
            sourceMap: true
        }))
        .pipe(gulp.dest(paths.tmp))
})

gulp.task('generateDocs', () => generateDoc())

gulp.task('serve', ['compile', 'generateDocs', 'watch'], () => {
    nodemon({
        script: paths.tmp,
        watch: paths.tmp,
        ext: 'js',
        execMap: {
            "": "node"
        },
        delay: 1
    })
})

gulp.task('watch', () => {
    let watcher = chokidar.watch(paths.src, {
        persistent: true,
        ignoreInitial: true
    })
    watcher
        .on('add', path => {
            gutil.log(
                'File',
                gutil.colors.green('added'),
                gutil.colors.magenta(path)
            )
            if (/\.ts$/.test(path))
                gulp.src(path, { base: paths.src })
                    .pipe(tsc({
                        module: 'commonjs',
                        target: 'es6',
                        noImplicitAny: false,
                        sourceMap: true
                    }))
                    .pipe(gulp.dest(paths.tmp))
            if (/\.yaml$/.test(path))
                generateDoc()
        })
        .on('change', path => {
            gutil.log(
                'File',
                gutil.colors.cyan('changed'),
                gutil.colors.magenta(path)
            )
            if (/\.ts$/.test(path))
                gulp.src(path, { base: paths.src })
                    .pipe(tsc({
                        module: 'commonjs',
                        target: 'es6',
                        noImplicitAny: false,
                        sourceMap: true
                    }))
                    .pipe(gulp.dest(paths.tmp))
            if (/\.yaml$/.test(path))
                generateDoc()
        })
        .on('unlink', path => {
            gutil.log(
                'File',
                gutil.colors.yellow('deleted'),
                gutil.colors.magenta(path)
            )
            let dest = path.replace(paths.src, paths.tmp)

            if (/\.ts$/.test(path)) {
                try {
                    fs.unlinkSync(dest)
                    nodemon.emit('restart')
                } catch (error) { }
            }
            if (/\.yaml$/.test(path))
                generateDoc()
        })

        // More possible events. 
        .on('addDir', path => {
            gutil.log(
                'Directory',
                gutil.colors.green('added'),
                gutil.colors.magenta(path)
            )
        })
        .on('unlinkDir', path => {
            gutil.log(
                'Directory',
                gutil.colors.yellow('deleted'),
                gutil.colors.magenta(path)
            )
            try {
                fs.unlinkSync()
            } catch (error) { }
        })
})