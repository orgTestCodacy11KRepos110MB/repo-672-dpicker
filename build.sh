#!env /bin/sh

browserify="$(npm bin)/browserify"
uglifyjs="$(npm bin)/uglifyjs"

GLOBAL_ARGS="-g unassertify -t babelify -t browserify-shim -x moment"
MIN_ARGS="$GLOBAL_ARGS -g uglifyify"

RELEASE_BUILD=0
if [[ $1 != '' ]]; then
  RELEASE_BUILD=1
fi

build() {
  args=$GLOBAL_ARGS

  if [[ $3 == 1 ]]; then
        args="-s DPicker $args"
  else
        args="-x ./src/dpicker.js $args"
  fi

  sh -c "$browserify $args src/$1 -o dist/$2.js"

  if [[ $RELEASE_BUILD == 1 ]]; then
    sh -c "$browserify -g uglifyify $args src/$1 | $uglifyjs -c > dist/$2.min.js"
  fi
}

rm dist/* &> /dev/null
mkdir dist &> /dev/null
build "dpicker" "dpicker" 1 &
build "plugins/time" "dpicker.time" &
build "plugins/modifiers" "dpicker.modifiers" &
build "plugins/arrow-navigation" "dpicker.arrow-navigation" &

wait

if [[ $RELEASE_BUILD == 1 ]]; then
   # Patching package.json
   patch package.json build/shim.patch

   # Build date + time
   sh -c "$browserify $GLOBAL_ARGS -s DPicker src/plugins/time.js -o dist/dpicker.datetime.js"
   sh -c "$browserify $MIN_ARGS -s DPicker src/plugins/time.js -o dist/dpicker.datetime.min.js"
   # Build all
   sh -c "$browserify $GLOBAL_ARGS -s DPicker src/all.js -o dist/dpicker.all.js"
   sh -c "$browserify $MIN_ARGS -s DPicker src/all -o dist/dpicker.all.min.js"

   # undo changes
   patch -R package.json build/shim.patch

   $browserify -g uglifyify src/polyfills.js -o dist/polyfills.min.js

   for f in dist/*.min.js; do
     echo "$f.gz: " $(node -pe "$(gzip -c $f | wc -c) * 0.001") kb
   done
fi

exit 0
