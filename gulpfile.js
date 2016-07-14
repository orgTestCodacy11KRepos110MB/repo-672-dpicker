'use strict'
const gulp = require('gulp')
const rename = require('gulp-rename')
const uglify = require('gulp-uglify')
const path = require('path')
const traceur = require('gulp-traceur')
const Transform = require('stream').Transform

const uml = (name, contents, inject) => {
  return `
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define('${name}', [${inject.map((e) => "'" + e + "'").join(', ')}], factory);
    } else if (typeof module === 'object' && module.exports) {
			  //node
        module.exports = factory(${inject.map((e) => "require('" + e.toLowerCase() + "')").join(', ')});
    } else {
        // Browser globals (root is window)
        root.${name} = factory(${inject.map((e) => 'root.' + e).join(', ')});
    }
}(this, function (${inject.join(', ')}) {
${contents}
  return ${name.replace('DPicker.modules.', '')};
}));
`
}

function wrap() {
  const transformStream = new Transform({objectMode: true})
  transformStream._transform = function(file, encoding, callback) {
    let error = null
    let name = path.basename(file.path, '.js').replace('dpicker', 'DPicker')
    let inject = ['moment', 'maquette']

    if (name != 'DPicker') {
      inject = ['DPicker', 'moment']
      name = name.replace('DPicker', 'DPicker.modules')
    }

    name = name.replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','')})


    file.contents = new Buffer(uml(name, file.contents.toString(), inject))

    callback(error, file)
  };

  return transformStream
};

gulp.task('default', function() {
  let name

  return gulp.src(['src/*.js', '!src/*.spec.js'])
  .pipe(traceur())
  .pipe(wrap())
  .pipe(gulp.dest('dist'))
  .pipe(uglify())
  .pipe(rename({suffix: '.min'}))
  .pipe(gulp.dest('dist'))
})

// stolen from https://github.com/AFASSoftware/maquette/blob/master/gulpfile.js#L136
gulp.task('check-size', ['default'], function(callback) {
  var zlib = require('zlib')
  var fs = require('fs')
  var input = fs.createReadStream('./dist/dpicker.min.js')
  var stream = input.pipe(zlib.createGzip())
  var length = 0
  stream.on('data', function(chunk) {
    length += chunk.length
  });
  stream.on('end', function() {
    console.log('gzipped size in kB:', length/1024)
    if (length >= 2.5 * 1024) {
      return callback(new Error('Claim that dpicker is only 2.5 kB gzipped no longer holds'))
    }
    callback()
  })
})

gulp.task('watch', ['default'], function() {
  gulp.watch(['src/*.js', '!src/*.spec.js'], ['default'])
})
